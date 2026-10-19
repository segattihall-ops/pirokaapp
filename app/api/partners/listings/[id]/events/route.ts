import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { MIGRATION, requireListing } from '@/lib/partners/server';
import type { PartnerEvent } from '@/lib/partners/shared';

export const dynamic = 'force-dynamic';

const SELECT = 'id, title, starts_at, max_attendees, review_status, review_note';

async function eventsOf(placeId: string | null, creatorId: string, listingKey: string): Promise<PartnerEvent[]> {
  const db = supabaseAdmin!;
  // Venue events hang off places.id; clinic listings have no places row, so their events carry a
  // `partner:<listing key>` tag in the (otherwise unused) photo column.
  const q = placeId
    ? db.from('events').select(SELECT).eq('place_id', placeId)
    : db.from('events').select(SELECT).eq('creator_id', creatorId).like('photo', `partner:${listingKey}%`);
  const { data, error } = await q.order('starts_at', { ascending: false }).limit(50);
  if (error) throw error;
  const ids = (data ?? []).map((e) => e.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: att } = await db.from('event_attendees').select('event_id').in('event_id', ids);
    for (const a of att ?? []) counts.set(a.event_id, (counts.get(a.event_id) ?? 0) + 1);
  }
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.title,
    startsAt: new Date(e.starts_at).toISOString(),
    capacity: e.max_attendees ?? null,
    rsvp: counts.get(e.id) ?? 0,
    status: (e.review_status ?? 'approved') as PartnerEvent['status'],
    note: e.review_note ?? null,
  }));
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await requireListing(g.session, decodeURIComponent(params.id));
  if (r.error) return r.error;
  try {
    const events = await eventsOf(r.listing.kind === 'place' ? r.listing.id : null, g.session.userId, r.listing.key);
    return NextResponse.json({ events }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e: any) {
    if (isMissingSchema(e)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: e?.message ?? 'Could not load events' }, { status: 500 });
  }
}

const Create = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).default('21:00'),
  capacity: z.number().int().positive().max(9999).nullable().optional(),
  about: z.string().trim().max(1000).optional(),
});

// The board's drug / sex-for-pay word list; the submit note in the prototype makes this rule explicit.
const BLOCKED = /\b(tina|meth|crystal|g\b|ghb|molly|mdma|coke|cocaine|poppers for sale|pnp|party\s*(and|n|&)\s*play|escort|for pay|\$\d{2,}\s*(hr|hour|h\b))/i;

/** Partners post events for their listing; they start in review and appear on the map once approved. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const r = await requireListing(g.session, decodeURIComponent(params.id));
  if (r.error) return r.error;
  const l = r.listing;

  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Add a name and a date.' }, { status: 400 });
  const { name, date, time, capacity, about } = parsed.data;
  if (BLOCKED.test(`${name} ${about ?? ''}`)) {
    return NextResponse.json({ error: 'No drug or sex-for-pay listings.' }, { status: 422 });
  }
  const starts = new Date(`${date}T${time}:00`);
  if (Number.isNaN(starts.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  if (starts.getTime() < Date.now() - 3600_000) return NextResponse.json({ error: 'That date has passed.' }, { status: 400 });
  const ends = new Date(starts.getTime() + 4 * 3600_000);

  await ensureUserRow(g.session);
  const db = supabaseAdmin!;
  const { data, error } = await db
    .from('events')
    .insert({
      creator_id: g.session.userId,
      title: name,
      description: about || null,
      location: `POINT(${l.lon} ${l.lat})`,
      location_name: l.name,
      // Clinic events have no places row; tag them with the listing key so the portal can list them.
      photo: l.kind === 'place' ? null : `partner:${l.key}`,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      category: l.kind === 'testing_site' ? 'meetup' : 'nightlife',
      max_attendees: capacity ?? null,
      place_id: l.kind === 'place' ? l.id : null,
      review_status: 'pending',
    })
    .select('id')
    .single();
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await db.from('audit_log').insert({
    actor_id: g.session.userId,
    action: 'partner.event.submit',
    target: data.id,
    details: null,
  });
  return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 });
}
