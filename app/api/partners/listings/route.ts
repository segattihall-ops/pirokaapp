import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { listingsFor } from '@/lib/partners/server';

export const dynamic = 'force-dynamic';

/** Listings the signed-in member manages. Empty when they have none (→ "Claim your listing"). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await listingsFor(g.session.userId);
  if (r.error) return r.error;
  return NextResponse.json({ listings: r.listings }, { headers: { 'Cache-Control': 'private, no-store' } });
}
