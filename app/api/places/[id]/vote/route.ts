import { POPPING_VOTES } from '@/lib/places/popping';
import { NextResponse } from 'next/server';
import { isUuid, requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

/** 5+ on-site votes in the last 90 minutes light the red flame on the place pin. */
const VOTE_WINDOW_MIN = 90;

async function tally(placeId: string) {
  const since = new Date(Date.now() - VOTE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabaseAdmin!
    .from('place_votes')
    .select('user_id', { count: 'exact', head: true })
    .eq('place_id', placeId)
    .gt('at', since);
  const votes = count ?? 0;
  return { votes, popping: votes >= POPPING_VOTES };
}

/** "It's popping!" — only members with an active "here" at this place can vote; one vote per 90 min. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  const me = g.session.userId;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });

  const { data: here } = await db
    .from('checkins')
    .select('kind')
    .eq('user_id', me)
    .eq('place_id', params.id)
    .eq('kind', 'here')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!here) return NextResponse.json({ error: 'Check in first — only people who are there can vote.' }, { status: 403 });

  const { error } = await db
    .from('place_votes')
    .upsert({ user_id: me, place_id: params.id, at: new Date().toISOString() }, { onConflict: 'user_id,place_id' });
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('040_places_v2'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mine: true, ...(await tally(params.id)) });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });
  await supabaseAdmin!.from('place_votes').delete().eq('user_id', g.session.userId).eq('place_id', params.id);
  return NextResponse.json({ ok: true, mine: false, ...(await tally(params.id)) });
}
