import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { paypalConfigured } from '@/lib/billing/paypal';
import { billingStatus } from '@/lib/billing/server';

export const dynamic = 'force-dynamic';

/** Plan, renewal, pause/cancel state, payment method and billing email for the signed-in member. */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await billingStatus(session.userId, paypalConfigured()));
}
