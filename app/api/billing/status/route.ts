import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { paypalConfigured } from '@/lib/billing/paypal';
import { billingStatus } from '@/lib/billing/server';
import { launchAllAccess, launchAllAccessUntil } from '@/lib/billing/launch';

export const dynamic = 'force-dynamic';

/** Plan, renewal, pause/cancel state, payment method and billing email for the signed-in member. */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // During the launch window every member gets every feature; `plan` stays the real billing plan so
  // the subscribe screen keeps showing the truth, while `allAccess` unlocks UI.
  const status = await billingStatus(session.userId, paypalConfigured());
  return NextResponse.json({
    ...status,
    allAccess: launchAllAccess(),
    allAccessUntil: launchAllAccessUntil(),
  });
}
