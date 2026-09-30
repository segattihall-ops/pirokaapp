import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { PAYPAL_PLANS, paypalConfigured } from '@/lib/billing/paypal';

export const dynamic = 'force-dynamic';

/** Returns what the PayPal Buttons need to start a subscription for the signed-in user. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!paypalConfigured()) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const { plan } = (await request.json().catch(() => ({}))) as { plan?: string };
  const planId = plan === 'plus' ? PAYPAL_PLANS.plus : plan === 'premium' ? PAYPAL_PLANS.premium : '';
  if (!planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  return NextResponse.json({ planId, customId: session.userId, email: session.email });
}
