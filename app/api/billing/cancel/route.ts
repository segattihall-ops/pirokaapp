import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  activatePayPalSubscription,
  cancelPayPalSubscription,
  getPayPalSubscription,
  paypalConfigured,
  suspendPayPalSubscription,
} from '@/lib/billing/paypal';
import { sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { withApi } from '@/lib/errors/server';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { billingStatus } from '@/lib/billing/server';

export const dynamic = 'force-dynamic';

const Body = z.object({ action: z.enum(['cancel', 'pause', 'resume']).default('cancel') });
const PAUSE_DAYS = 30;

/**
 * Cancel keeps the plan until the end of the paid period (`cancel_at`); pause suspends billing at
 * PayPal for a month (`paused_until`, auto-resumed by the lifecycle cron); resume re-activates a
 * paused subscription. A cancelled PayPal subscription cannot be revived — resume then answers
 * `needsCheckout` so the client shows the plan picker.
 */
export const POST = withApi('/api/billing/cancel', async (request: Request) => {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!paypalConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const { action } = parsed.data;
  const db = supabaseAdmin;

  const { data: user, error: readError } = await db
    .from('users')
    .select('paypal_subscription_id, plan, email, subscription_status, cancel_at, paused_until, renews_at')
    .eq('id', session.userId)
    .maybeSingle();
  if (readError && isMissingSchema(readError))
    return NextResponse.json(schemaPendingResponse('041_billing_v2'), { status: 503 });
  const subscriptionId = user?.paypal_subscription_id as string | null | undefined;
  if (!subscriptionId) return NextResponse.json({ error: 'No active subscription' }, { status: 404 });

  const audit = (act: string, details: unknown) =>
    db.from('audit_log').insert({ actor_id: session.userId, action: act, target: subscriptionId, details });

  if (action === 'resume') {
    if (user?.paused_until) {
      try {
        await activatePayPalSubscription(subscriptionId);
      } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'PayPal could not resume the subscription' }, { status: 502 });
      }
      await db
        .from('users')
        .update({ paused_until: null, subscription_status: 'ACTIVE' })
        .eq('id', session.userId);
      await audit('billing.resume', { from: 'paused' });
      return NextResponse.json({ ok: true, ...(await billingStatus(session.userId, true)) });
    }
    // Cancelled at PayPal: a new subscription is the only way back.
    return NextResponse.json({ ok: false, needsCheckout: true, ...(await billingStatus(session.userId, true)) });
  }

  if (action === 'pause') {
    if (user?.paused_until) return NextResponse.json({ error: 'Already paused' }, { status: 409 });
    try {
      await suspendPayPalSubscription(subscriptionId);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'PayPal could not pause the subscription' }, { status: 502 });
    }
    const until = new Date(Date.now() + PAUSE_DAYS * 86400_000).toISOString();
    await db
      .from('users')
      .update({ paused_until: until, subscription_status: 'SUSPENDED' })
      .eq('id', session.userId);
    await audit('billing.pause', { until });
    await track({ userId: session.userId, event: 'subscription_paused', props: { plan: String(user?.plan ?? '') } });
    return NextResponse.json({ ok: true, ...(await billingStatus(session.userId, true)) });
  }

  // cancel
  let keepUntil: string | null = user?.renews_at ?? null;
  try {
    if (!keepUntil) {
      const sub = await getPayPalSubscription(subscriptionId).catch(() => null);
      keepUntil = sub?.billing_info?.next_billing_time ?? null;
    }
    await cancelPayPalSubscription(subscriptionId);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'PayPal cancellation failed' }, { status: 502 });
  }
  if (!keepUntil || new Date(keepUntil).getTime() < Date.now()) {
    keepUntil = new Date(Date.now() + 30 * 86400_000).toISOString();
  }

  await db
    .from('users')
    .update({
      subscription_status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancel_at: keepUntil,
      paused_until: null,
    })
    .eq('id', session.userId);
  await audit('billing.cancel', { keepUntil });
  await track({
    userId: session.userId,
    event: EVENTS.subscription_cancelled,
    props: { from: String(user?.plan ?? ''), source: 'user' },
  });
  const to = session.email ?? (user?.email as string | null);
  if (to) void sendEmail({ to, userId: session.userId, template: 'cancelled', ...templates.cancelled() });

  return NextResponse.json({ ok: true, ...(await billingStatus(session.userId, true)) });
});
