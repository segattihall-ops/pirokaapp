import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAdmin } from '@/lib/admin/guard';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { MIGRATION } from '@/lib/partners/server';

export const dynamic = 'force-dynamic';

/** Partner queue: events awaiting review and listing claims. Staff never see attendee identities. */
export async function GET() {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const [{ data: events, error: e1 }, { data: claims, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('events')
      .select('id, title, description, location_name, starts_at, max_attendees, review_status, review_note, created_at, place_id')
      .in('review_status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('partner_claims')
      .select('id, user_id, listing_name, address, kind, contact, status, place_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  const err = e1 ?? e2;
  if (err) {
    if (isMissingSchema(err)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  return NextResponse.json({
    events: (events ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      about: e.description ?? '',
      venue: e.location_name,
      startsAt: new Date(e.starts_at).toISOString(),
      capacity: e.max_attendees ?? null,
      status: e.review_status,
      note: e.review_note ?? null,
      createdAt: e.created_at,
    })),
    claims: (claims ?? []).map((c) => ({
      id: c.id,
      userId: c.user_id,
      listingName: c.listing_name,
      address: c.address,
      kind: c.kind,
      contact: c.contact,
      status: c.status,
      placeId: c.place_id ?? null,
      createdAt: c.created_at,
    })),
  });
}

const Patch = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve_event'), id: z.string().uuid(), note: z.string().max(300).optional() }),
  z.object({ action: z.literal('reject_event'), id: z.string().uuid(), note: z.string().max(300).optional() }),
  z.object({
    action: z.literal('approve_claim'),
    id: z.string().uuid(),
    /** Existing place to attach; omitted → a new unverified place is created from the claim. */
    placeId: z.string().uuid().optional(),
    note: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal('reject_claim'), id: z.string().uuid(), note: z.string().max(300).optional() }),
]);

export async function PATCH(request: Request) {
  const g = await requireAdmin();
  if ('response' in g) return g.response;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const body = parsed.data;
  const db = supabaseAdmin;
  const now = new Date().toISOString();
  const me = g.session.userId;

  if (body.action === 'approve_event' || body.action === 'reject_event') {
    const status = body.action === 'approve_event' ? 'approved' : 'rejected';
    const { error } = await db
      .from('events')
      .update({ review_status: status, reviewed_by: me, reviewed_at: now, review_note: body.note ?? null })
      .eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (body.action === 'reject_claim') {
    const { error } = await db
      .from('partner_claims')
      .update({ status: 'rejected', reviewed_by: me, reviewed_at: now })
      .eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: claim } = await db
      .from('partner_claims')
      .select('user_id, listing_name, address, kind, place_id, status')
      .eq('id', body.id)
      .maybeSingle();
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    if (claim.status !== 'pending') return NextResponse.json({ error: 'Claim already reviewed' }, { status: 409 });

    // Attach to a place: the one picked by staff, the one named in the claim, or a fresh listing that
    // appears on the map once a member suggests / staff verify its position (0,0 keeps it off-map).
    let placeId = body.placeId ?? claim.place_id ?? null;
    if (!placeId) {
      const { data: p, error } = await db
        .from('places')
        .insert({
          name: claim.listing_name,
          kind: claim.kind === 'clinic' ? 'other' : 'venue',
          address: claim.address,
          geo: 'POINT(0 0)',
          verified: false,
          partner_verified: true,
        })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      placeId = p.id;
    } else {
      await db.from('places').update({ partner_verified: true }).eq('id', placeId);
    }
    const { error: mErr } = await db
      .from('partner_members')
      .upsert({ user_id: claim.user_id, listing_kind: 'place', place_id: placeId, role: 'owner' }, { onConflict: 'user_id,place_id', ignoreDuplicates: true });
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    await db
      .from('partner_claims')
      .update({ status: 'approved', reviewed_by: me, reviewed_at: now, place_id: placeId })
      .eq('id', body.id);
  }

  await db.from('audit_log').insert({ actor_id: me, action: `partner.${body.action}`, target: body.id, details: null });
  return NextResponse.json({ ok: true });
}
