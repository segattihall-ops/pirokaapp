import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { paypalConfigured } from '@/lib/billing/paypal';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const configured = paypalConfigured();
  if (!supabaseAdmin) {
    return NextResponse.json({ configured, plan: 'free', status: null, subscriptionId: null });
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
  });
}
