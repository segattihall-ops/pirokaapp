import { NextResponse } from 'next/server';
import { isUuid, requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

export type PlaceDetail = {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  verified: boolean;
  peakHint: string | null;
  here: number;
  onTheWay: number;
  visitors: number;
  /** Hour of day (0–23) with the most check-ins in the last 30 days, or null when there is no history. */
  peakHour: number | null;
  votes: number;
  popping: boolean;
  myVote: boolean;
  my: { kind: 'here' | 'going'; expiresAt: string; etaAt: string | null } | null;
};

/** Place detail: counts only, never who. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const db = supabaseAdmin!;
  const me = g.session.userId;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });

  await db.rpc('record_no_shows').then(() => undefined, () => undefined);
  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - 90 * 60_000).toISOString();

  const [{ data: p, error }, { data: hereRows }, { count: going }, { data: peak }, { count: votes }, { data: mine }, { data: my }] =
    await Promise.all([
      db.from('places').select('id, name, kind, address, verified, peak_hint').eq('id', params.id).maybeSingle(),
      db.from('checkins').select('user_id').eq('place_id', params.id).eq('kind', 'here').gt('expires_at', nowIso),
      db.from('checkins').select('user_id', { count: 'exact', head: true }).eq('place_id', params.id).eq('kind', 'going').gt('expires_at', nowIso),
      db.rpc('place_peak_hour', { p_place: params.id }),
      db.from('place_votes').select('user_id', { count: 'exact', head: true }).eq('place_id', params.id).gt('at', since),
      db.from('place_votes').select('user_id').eq('place_id', params.id).eq('user_id', me).gt('at', since).maybeSingle(),
      db.from('checkins').select('kind, expires_at, eta_at').eq('place_id', params.id).eq('user_id', me).gt('expires_at', nowIso).maybeSingle(),
    ]);

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('040_places_v2'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!p) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  // Visitors = members here now whose active PIROKA Mode is "Visiting" (a count, never who).
  const hereIds = (hereRows ?? []).map((r) => r.user_id as string);
  const here = hereIds.length;
  let visitors = 0;
  if (here) {
    const { count } = await db
      .from('statuses')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', hereIds)
      .eq('intent', 'visiting')
      .gt('ends_at', nowIso);
    visitors = count ?? 0;
  }

  const peakRow = Array.isArray(peak) ? (peak[0] as { hour?: number } | undefined) : null;
  const v = votes ?? 0;
  const detail: PlaceDetail = {
    id: p.id,
    name: p.name,
    kind: p.kind,
    address: p.address ?? null,
    verified: Boolean(p.verified),
    peakHint: p.peak_hint ?? null,
    here,
    onTheWay: going ?? 0,
    visitors,
    peakHour: typeof peakRow?.hour === 'number' ? peakRow.hour : null,
    votes: v,
    popping: v >= 5,
    myVote: Boolean(mine),
    my: my ? { kind: my.kind as 'here' | 'going', expiresAt: my.expires_at, etaAt: my.eta_at ?? null } : null,
  };
  return NextResponse.json(detail);
}
