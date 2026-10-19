import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  paypalConfigured,
  planFromPayPalPlanId,
  verifyPayPalWebhook,
  webhookHeadersFrom,
} from '@/lib/billing/paypal';
import { emailOfUser, sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { opsAlert } from '@/lib/alerts/server';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

type PayPalEvent = {
  id: string;
  event_type: string;
  resource: Record<string, any>;
};

async function audit(action: string, target: string | null, details: unknown) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('audit_log').insert({ actor_id: null, action, target, details });
}

async function userIdForSubscription(subscriptionId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('paypal_subscription_id', subscriptionId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function mail(
  userId: string | null,
  template: keyof typeof templates,
  content: ReturnType<(typeof templates)[keyof typeof templates]>,
) {
  if (!userId) return;
  const who = await emailOfUser(userId);
  if (!who) return;
  await sendEmail({ to: who.email, userId, template, ...content });
}

export const POST = withApi('/api/webhooks/paypal', async (request: Request) => {
  if (!paypalConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const headers = webhookHeadersFrom(request.headers);
  if (!headers) return NextResponse.json({ error: 'Missing PayPal headers' }, { status: 400 });

  let event: PayPalEvent;
  try {
    event = (await request.json()) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let valid = false;
  try {
    valid = await verifyPayPalWebhook(headers, event);
  } catch (e) {
    console.error('PayPal verification error:', e);
  }
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const db = supabaseAdmin;
  const res = event.resource ?? {};

  try {
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
        // custom_id is set client-side at checkout, so it is only trusted for a member who has no
        // other subscription on file; an existing different subscription id means someone is trying
        // to attach their subscription to another account.
        const claimed = res.custom_id as string | undefined;
        let userId = await userIdForSubscription(res.id);
        if (!userId && claimed) {
          const { data: u } = await db
            .from('users')
            .select('paypal_subscription_id')
            .eq('id', claimed)
            .maybeSingle();
          if (u && (!u.paypal_subscription_id || u.paypal_subscription_id === res.id)) userId = claimed;
          else await audit('paypal.custom_id_mismatch', claimed, { subscription: res.id });
        }
        const active = res.status === 'ACTIVE';
        const plan = active ? planFromPayPalPlanId(res.plan_id) : undefined;
        const renewsAt = res.billing_info?.next_billing_time ?? null;
        const patch = {
          paypal_subscription_id: res.id,
          subscription_status: res.status,
          paypal_payer_email: res.subscriber?.email_address ?? null,
          renews_at: renewsAt,
          ...(plan ? { plan, cancelled_at: null, cancel_at: null, payment_failed_at: null, paused_until: null } : {}),
        };
        const q = userId
          ? db.from('users').update(patch).eq('id', userId)
          : db.from('users').update(patch).eq('paypal_subscription_id', res.id);
        const { error } = await q;
        if (error) throw error;
        await audit(`paypal.${event.event_type}`, userId ?? res.id, {
          subscription: res.id,
          plan: res.plan_id,
        });
        if (active && plan && plan !== 'free' && event.event_type !== 'BILLING.SUBSCRIPTION.UPDATED') {
          await track({ userId, event: EVENTS.subscribed, props: { plan, source: 'webhook' } });
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const userId = (res.custom_id as string | undefined) ?? (await userIdForSubscription(res.id));
        const status = res.status ?? event.event_type.split('.').pop();
        // A member who cancelled in the app keeps the plan until cancel_at; lifecycle ends it then.
        const { data: pending } = await db
          .from('users')
          .select('cancel_at')
          .eq('paypal_subscription_id', res.id)
          .maybeSingle();
        const keepsAccess = Boolean(pending?.cancel_at && new Date(pending.cancel_at).getTime() > Date.now());
        const { error } = await db
          .from('users')
          .update({
            ...(keepsAccess ? {} : { plan: 'free' }),
            subscription_status: status,
            cancelled_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', res.id);
        if (error) throw error;
        await audit(`paypal.${event.event_type}`, userId ?? res.id, { subscription: res.id });
        await track({ userId, event: EVENTS.subscription_cancelled, props: { status, source: 'webhook' } });
        if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED')
          await mail(userId, 'cancelled', templates.cancelled());
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const userId = (res.custom_id as string | undefined) ?? (await userIdForSubscription(res.id));
        const { error } = await db
          .from('users')
          .update({ subscription_status: 'PAYMENT_FAILED', payment_failed_at: new Date().toISOString() })
          .eq('paypal_subscription_id', res.id);
        if (error) throw error;
        await db.from('payments').upsert(
          {
            payment_id: `${res.id}:${event.id}`,
            user_id: userId,
            amount: 0,
            currency: 'USD',
            status: 'FAILED',
            provider: 'paypal',
            description: 'Subscription payment failed',
          },
          { onConflict: 'payment_id' },
        );
        await track({ userId, event: EVENTS.payment_failed, props: { subscription: res.id } });
        await mail(userId, 'paymentFailed', templates.paymentFailed(0));
        await opsAlert(
          'payment',
          `Payment failed for subscription ${res.id}${userId ? ` (user ${userId.slice(0, 8)}…)` : ''}`,
        );
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = res.billing_agreement_id as string | undefined;
        if (!subscriptionId) break;
        const { data: user } = await db
          .from('users')
          .select('id, plan')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle();
        const amount = Number(res.amount?.total ?? 0);
        const currency = (res.amount?.currency as string | undefined) ?? 'USD';
        const { data: inserted } = await db
          .from('payments')
          .upsert(
            {
              payment_id: res.id,
              user_id: user?.id ?? null,
              amount,
              currency,
              status: 'COMPLETED',
              provider: 'paypal',
              description: 'Subscription payment',
            },
            { onConflict: 'payment_id', ignoreDuplicates: true },
          )
          .select('id');
        if (user) {
          await db
            .from('users')
            .update({ subscription_status: 'ACTIVE', payment_failed_at: null })
            .eq('id', user.id);
          await track({ userId: user.id, event: EVENTS.payment_completed, props: { amount, currency } });
          // Only the first time we see this sale: PayPal retries webhooks.
          if (inserted && inserted.length > 0) {
            await mail(
              user.id,
              'receipt',
              templates.receipt(amount, currency, String(user.plan ?? 'plan'), res.id),
            );
          }
        }
        break;
      }

      default:
        await audit(`paypal.unhandled`, null, { type: event.event_type, id: event.id });
    }
  } catch (e) {
    console.error('PayPal webhook handling failed:', e);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
