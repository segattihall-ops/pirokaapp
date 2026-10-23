import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { newCheckoutClosedResponse } from '@/lib/billing/guard';
import { PAYPAL_PLANS, paypalConfigured, revisePayPalSubscription } from '@/lib/billing/paypal';
import { billingStatus } from '@/lib/billing/server';
import { appUrl } from '@/lib/app-url';
import { withApi } from '@/lib/errors/server';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

const Body = z.object({ plan: z.enum(['plus', 'premium']) });

/**
 * Change plan on an active subscription (Premium → Plus downgrade, Plus → Premium upgrade) through
 * PayPal's revise call. When PayPal wants the buyer to approve the new price it returns an
 * `approveUrl`; the plan flips when the webhook reports the updated plan_id.
 */
export const POST = withApi('/api/billing/change', async (request: Request) => {
  // A plan change revises the PayPal price. While charging is off, refuse before PayPal.
  const closed = newCheckoutClosedResponse();
  if (closed) return closed;
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!paypalConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const target = parsed.data.plan;
  const planId = PAYPAL_PLANS[target];
  if (!planId) return NextResponse.json({ error: 'Plan not configured' }, { status: 503 });

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('paypal_subscription_id, plan, subscription_status, cancel_at')
    .eq('id', session.userId)
    .maybeSingle();
  if (error && isMissingSchema(error))
    return NextResponse.json(schemaPendingResponse('041_billing_v2'), { status: 503 });
  const subscriptionId = user?.paypal_subscription_id as string | null | undefined;
  if (!subscriptionId || user?.subscription_status !== 'ACTIVE') {
    // Nothing to revise: the client starts a fresh checkout for the chosen plan.
    return NextResponse.json({ ok: false, needsCheckout: true, plan: target });
  }
  if (user.plan === target)
    return NextResponse.json({ ok: true, ...(await billingStatus(session.userId, true)) });

  let approveUrl: string | null = null;
  try {
    const r = await revisePayPalSubscription(subscriptionId, planId, appUrl('/app/me/plan?revised=1'));
    approveUrl = r.links?.find((l) => l.rel === 'approve')?.href ?? null;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'PayPal could not change the plan' }, { status: 502 });
  }

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'billing.change',
    target: subscriptionId,
    details: { from: user.plan, to: target, approval: Boolean(approveUrl) },
  });

  if (!approveUrl) {
    // Revised without buyer approval: apply now; the webhook confirms it.
    await supabaseAdmin.from('users').update({ plan: target }).eq('id', session.userId);
    return NextResponse.json({ ok: true, ...(await billingStatus(session.userId, true)) });
  }
  return NextResponse.json({ ok: true, approveUrl, ...(await billingStatus(session.userId, true)) });
});
