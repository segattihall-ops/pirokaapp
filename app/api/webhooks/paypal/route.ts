import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  paypalConfigured,
  planFromPayPalPlanId,
  verifyPayPalWebhook,
  webhookHeadersFrom,
} from '@/lib/billing/paypal';

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

export async function POST(request: Request) {
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
        const userId = res.custom_id as string | undefined;
        const active = res.status === 'ACTIVE';
        const plan = active ? planFromPayPalPlanId(res.plan_id) : undefined;
        const patch = {
          paypal_subscription_id: res.id,
          subscription_status: res.status,
          ...(plan ? { plan } : {}),
        };
        const q = userId
          ? db.from('users').update(patch).eq('id', userId)
          : db.from('users').update(patch).eq('paypal_subscription_id', res.id);
        const { error } = await q;
        if (error) throw error;
        await audit(`paypal.${event.event_type}`, userId ?? res.id, { subscription: res.id, plan: res.plan_id });
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const { error } = await db
          .from('users')
          .update({ plan: 'free', subscription_status: res.status ?? event.event_type.split('.').pop() })
          .eq('paypal_subscription_id', res.id);
        if (error) throw error;
        await audit(`paypal.${event.event_type}`, res.custom_id ?? res.id, { subscription: res.id });
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const { error } = await db
          .from('users')
          .update({ subscription_status: 'PAYMENT_FAILED' })
          .eq('paypal_subscription_id', res.id);
        if (error) throw error;
        await db.from('payments').upsert(
          {
            payment_id: `${res.id}:${event.id}`,
            user_id: res.custom_id ?? null,
            amount: 0,
            currency: 'USD',
            status: 'FAILED',
            provider: 'paypal',
            description: 'Subscription payment failed',
          },
          { onConflict: 'payment_id' },
        );
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = res.billing_agreement_id as string | undefined;
        if (!subscriptionId) break;
        const { data: user } = await db
          .from('users')
          .select('id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle();
        await db.from('payments').upsert(
          {
            payment_id: res.id,
            user_id: user?.id ?? null,
            amount: Number(res.amount?.total ?? 0),
            currency: res.amount?.currency ?? 'USD',
            status: 'COMPLETED',
            provider: 'paypal',
            description: 'Subscription payment',
          },
          { onConflict: 'payment_id' },
        );
        if (user) await db.from('users').update({ subscription_status: 'ACTIVE' }).eq('id', user.id);
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
}
