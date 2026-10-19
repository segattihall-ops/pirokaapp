import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { HoursSchema, MIGRATION, requireListing } from '@/lib/partners/server';
import { CLINIC_TAGS, VENUE_TAGS } from '@/lib/partners/shared';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await requireListing(g.session, decodeURIComponent(params.id));
  if (r.error) return r.error;
  return NextResponse.json({ listing: r.listing }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const Patch = z.object({
  hours: HoursSchema.optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

/** Hours and what the listing offers. Only the known tag lists are accepted. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await requireListing(g.session, decodeURIComponent(params.id));
  if (r.error) return r.error;
  const l = r.listing;

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid hours or tags' }, { status: 400 });
  const pool: readonly string[] = l.kind === 'testing_site' ? CLINIC_TAGS : VENUE_TAGS;
  const tags = parsed.data.tags?.filter((t) => pool.includes(t));

  const db = supabaseAdmin!;
  const q =
    l.kind === 'place'
      ? db
          .from('places')
          .update({ ...(parsed.data.hours && { hours: parsed.data.hours }), ...(tags && { tags }) })
          .eq('id', l.id)
      : db
          .from('testing_sites')
          .update({ ...(parsed.data.hours && { hours_json: parsed.data.hours }), ...(tags && { services: tags }) })
          .eq('id', l.id);
  const { error } = await q;
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await db.from('audit_log').insert({
    actor_id: g.session.userId,
    action: 'partner.listing.update',
    target: l.key,
    details: null,
  });
  return NextResponse.json({ ok: true, hours: parsed.data.hours ?? l.hours, tags: tags ?? l.tags });
}
