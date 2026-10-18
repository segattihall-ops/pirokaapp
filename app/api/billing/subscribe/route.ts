import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getPayPalSubscription, paypalConfigured, planFromPayPalPlanId } from '@/lib/billing/paypal';
import { sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

/** Called from the PayPal Buttons onApprove. Confirms the subscription with PayPal before granting a plan. */
export const POST = withApi('/api/billing/subscribe', async (request: Request) => {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!paypalConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const { subscriptionId } = (await request.json().catch(() => ({}))) as { subscriptionId?: string };
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
  }

  let sub;
  try {
    sub = await getPayPalSubscription(subscriptionId);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Could not look up subscription' }, { status: 502 });
  }

  // Checkout always stamps custom_id with the buyer; a subscription without it, or with someone
  // else's id, must not unlock this account. One PayPal subscription unlocks exactly one member.
  if (sub.custom_id !== session.userId) {
    return NextResponse.json({ error: 'Subscription belongs to another account' }, { status: 403 });
  }
  const { data: holder } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('paypal_subscription_id', sub.id)
    .neq('id', session.userId)
    .maybeSingle();
  if (holder) return NextResponse.json({ error: 'Subscription is already in use' }, { status: 409 });
  const plan = planFromPayPalPlanId(sub.plan_id);
  if (plan === 'free') return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });

  const active = sub.status === 'ACTIVE' || sub.status === 'APPROVED';
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      paypal_subscription_id: sub.id,
      subscription_status: sub.status,
      ...(active ? { plan, cancelled_at: null, payment_failed_at: null } : {}),
    })
    .eq('id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'billing.subscribe',
    target: sub.id,
    details: { plan, status: sub.status },
  });
  await track({
    userId: session.userId,
    event: EVENTS.subscribed,
    props: { plan, status: sub.status, source: 'checkout' },
  });
  if (active) {
    const to = session.email ?? sub.subscriber?.email_address;
    if (to)
      void sendEmail({ to, userId: session.userId, template: 'subscribed', ...templates.subscribed(plan) });
  }

  return NextResponse.json({ plan: active ? plan : 'free', status: sub.status, subscriptionId: sub.id });
});
