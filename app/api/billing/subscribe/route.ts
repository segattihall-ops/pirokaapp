import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getPayPalSubscription, paypalConfigured, planFromPayPalPlanId } from '@/lib/billing/paypal';

export const dynamic = 'force-dynamic';

/** Called from the PayPal Buttons onApprove. Confirms the subscription with PayPal before granting a plan. */
export async function POST(request: Request) {
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

  if (sub.custom_id && sub.custom_id !== session.userId) {
    return NextResponse.json({ error: 'Subscription belongs to another account' }, { status: 403 });
  }
  const plan = planFromPayPalPlanId(sub.plan_id);
  if (plan === 'free') return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });

  const active = sub.status === 'ACTIVE' || sub.status === 'APPROVED';
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      paypal_subscription_id: sub.id,
      subscription_status: sub.status,
      ...(active ? { plan } : {}),
    })
    .eq('id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'billing.subscribe',
    target: sub.id,
    details: { plan, status: sub.status },
  });

  return NextResponse.json({ plan: active ? plan : 'free', status: sub.status, subscriptionId: sub.id });
}
