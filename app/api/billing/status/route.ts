import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { paypalConfigured } from '@/lib/billing/paypal';
import { launchAllAccess, launchAllAccessUntil } from '@/lib/billing/launch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // During the launch window every member gets every feature; `plan` stays the real billing plan so
  // the subscribe screen keeps showing the truth (and the upgrade CTA), while `allAccess` unlocks UI.
  const allAccess = launchAllAccess();
  const allAccessUntil = launchAllAccessUntil();

  const configured = paypalConfigured();
  if (!supabaseAdmin) {
    return NextResponse.json({
      configured,
      plan: 'free',
      status: null,
      subscriptionId: null,
      allAccess,
      allAccessUntil,
    });
  }

  const { data } = await supabaseAdmin
    .from('users')
    .select('plan, subscription_status, paypal_subscription_id')
    .eq('id', session.userId)
    .maybeSingle();

  return NextResponse.json({
    configured,
    plan: data?.plan ?? 'free',
    status: data?.subscription_status ?? null,
    subscriptionId: data?.paypal_subscription_id ?? null,
    allAccess,
    allAccessUntil,
  });
}
