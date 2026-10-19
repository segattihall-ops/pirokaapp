import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { MIGRATION } from '@/lib/partners/server';

export const dynamic = 'force-dynamic';

const Claim = z.object({
  listingName: z.string().trim().min(2).max(120),
  address: z.string().trim().min(4).max(200),
  kind: z.enum(['venue', 'clinic', 'organizer']),
  contact: z.string().trim().min(5).max(200),
  placeId: z.string().uuid().optional(),
});

/** The member's claims (pending / approved / rejected). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const { data, error } = await supabaseAdmin!
    .from('partner_claims')
    .select('id, listing_name, address, kind, status, created_at')
    .eq('user_id', g.session.userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    claims: (data ?? []).map((c) => ({
      id: c.id,
      listingName: c.listing_name,
      address: c.address,
      kind: c.kind,
      status: c.status,
      createdAt: c.created_at,
    })),
  });
}

/** "Claim your listing": one open claim per member at a time; staff verify and attach the listing. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Claim.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Fill in the listing name, address and a contact.' }, { status: 400 });

  const db = supabaseAdmin!;
  await ensureUserRow(g.session);
  const { count, error: countErr } = await db
    .from('partner_claims')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', g.session.userId)
    .eq('status', 'pending');
  if (countErr) {
    if (isMissingSchema(countErr)) return NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 });
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= 1) return NextResponse.json({ error: 'You already have a claim in review.' }, { status: 409 });

  const { listingName, address, kind, contact, placeId } = parsed.data;
  const { data, error } = await db
    .from('partner_claims')
    .insert({
      user_id: g.session.userId,
      listing_name: listingName,
      address,
      kind,
      contact,
      place_id: placeId ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 });
}
