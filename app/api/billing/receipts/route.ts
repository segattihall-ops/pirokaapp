import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { listReceipts } from '@/lib/billing/server';

export const dynamic = 'force-dynamic';

/** The member's receipts: PayPal charges and $0 promo/invite redemptions. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  return NextResponse.json(await listReceipts(g.session.userId));
}
