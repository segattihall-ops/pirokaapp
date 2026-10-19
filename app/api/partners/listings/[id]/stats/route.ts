import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { MIGRATION, requireListing, statsFor } from '@/lib/partners/server';

export const dynamic = 'force-dynamic';

/** Four stat tiles — totals only. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await requireListing(g.session, decodeURIComponent(params.id));
  if (r.error) return r.error;
  try {
    return NextResponse.json({ stats: await statsFor(r.listing) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e: any) {
    if (isMissingSchema(e)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    console.error('partner stats failed', e);
    return NextResponse.json({ error: 'Could not load stats' }, { status: 500 });
  }
}
