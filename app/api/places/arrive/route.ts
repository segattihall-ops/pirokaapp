import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

/** Must match ARRIVE_RADIUS_M in lib/places/auto-checkin.ts. */
const ARRIVE_RADIUS_M = 150;
const HERE_MIN = 240;

const Body = z.object({
  placeId: z.string().uuid(),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

/**
 * Auto check-in on arrival. The client sends its current fix; PostGIS checks it is within 150 m of a
 * place the member is "going" to, and the check-in flips to "here" (4 h). The fix is used for that
 * one comparison and never stored or echoed back.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  const me = g.session.userId;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'placeId, lat and lng required' }, { status: 400 });
  const { placeId, lat, lng } = parsed.data;

  const { data: going } = await db
    .from('checkins')
    .select('kind')
    .eq('user_id', me)
    .eq('place_id', placeId)
    .eq('kind', 'going')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!going) return NextResponse.json({ arrived: false, reason: 'not_going' });

  const { data: near, error } = await db.rpc('place_within', {
    p_place: placeId,
    user_lat: lat,
    user_lon: lng,
    max_m: ARRIVE_RADIUS_M,
  });
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('040_places_v2'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!near) return NextResponse.json({ arrived: false, reason: 'too_far' });

  const expiresAt = new Date(Date.now() + HERE_MIN * 60_000).toISOString();
  await db.from('checkins').delete().eq('user_id', me).eq('kind', 'here');
  const { error: upErr } = await db
    .from('checkins')
    .upsert({ user_id: me, place_id: placeId, kind: 'here', expires_at: expiresAt, eta_at: null }, { onConflict: 'user_id,place_id' });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ arrived: true, expiresAt });
}
