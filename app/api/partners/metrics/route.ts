import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const Body = z.object({
  kind: z.enum(['view', 'directions', 'call']),
  listingKind: z.enum(['place', 'testing_site']),
  listingId: z.string().min(1).max(64),
});

/**
 * Anonymous partner counters (profile view, directions tap, call tap). Nothing about the member is
 * stored — only that it happened. Fire-and-forget from the client; always answers 204.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  const { kind, listingKind, listingId } = parsed.data;
  await supabaseAdmin!
    .from('partner_metrics')
    .insert({ listing_kind: listingKind, listing_id: listingId, kind })
    .then(({ error }) => error && console.warn('partner metric skipped', error.code));
  return new NextResponse(null, { status: 204 });
}
