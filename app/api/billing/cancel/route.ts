import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { cancelPayPalSubscription, paypalConfigured } from '@/lib/billing/paypal';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!paypalConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('paypal_subscription_id')
    .eq('id', session.userId)
    .maybeSingle();
  const subscriptionId = user?.paypal_subscription_id as string | null | undefined;
  if (!subscriptionId) return NextResponse.json({ error: 'No active subscription' }, { status: 404 });

  try {
    await cancelPayPalSubscription(subscriptionId);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'PayPal cancellation failed' }, { status: 502 });
  }

  await supabaseAdmin
    .from('users')
    .update({ plan: 'free', subscription_status: 'CANCELLED' })
    .eq('id', session.userId);
  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'billing.cancel',
    target: subscriptionId,
    details: null,
  });

  return NextResponse.json({ plan: 'free', status: 'CANCELLED' });
}
