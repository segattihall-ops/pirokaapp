import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser, UUID_RE } from '@/lib/api/guard';
import { ensureUserRow } from '@/lib/db/users';
import { notifyMany } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const MAX_TRIPS = 5;
const ARRIVAL_RADIUS_M = 50_000;
const Body = z.object({
  city: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  arriveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights: z.number().int().min(1).max(30).default(3),
});

const today = () => new Date().toISOString().slice(0, 10);

/** My announced trips (upcoming or in progress). */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const { data } = await supabaseAdmin!
    .from('trips')
    .select('id, city, arrive_on, nights, created_at')
    .eq('user_id', g.session.userId)
    .order('arrive_on');
  const trips = (data ?? []).filter((t) => addDays(t.arrive_on, t.nights) >= today());
  return NextResponse.json({ trips });
}

/** Announce a trip: favourites who are near that city get an arrival alert. Only the city is stored, never an address. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid trip' }, { status: 400 });
  const { city, lat, lon, arriveOn, nights } = parsed.data;
  if (arriveOn < today()) return NextResponse.json({ error: 'Arrival must be today or later' }, { status: 400 });

  await ensureUserRow(g.session);
  const { data: mine } = await db.from('trips').select('id, city, arrive_on, nights').eq('user_id', me);
  const active = (mine ?? []).filter((t) => addDays(t.arrive_on, t.nights) >= today());
  if (active.length >= MAX_TRIPS) return NextResponse.json({ error: `Up to ${MAX_TRIPS} upcoming trips` }, { status: 409 });
  const dup = active.find((t) => t.city.toLowerCase() === city.toLowerCase() && t.arrive_on === arriveOn);
  if (dup) return NextResponse.json({ trip: dup });

  const { data: trip, error } = await db
    .from('trips')
    .insert({ user_id: me, city, geo: `SRID=4326;POINT(${lon} ${lat})`, arrive_on: arriveOn, nights })
    .select('id, city, arrive_on, nights, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Arrival alerts, fire-and-forget.
  Promise.all([db.rpc('favoriters_near', { owner: me, center_lat: lat, center_lon: lon, radius_m: ARRIVAL_RADIUS_M }), userCards([me])])
    .then(([{ data: fans }, cards]) =>
      notifyMany(((fans ?? []) as { user_id: string }[]).map((f) => f.user_id), {
        kind: 'arrival',
        title: `${displayName(cards.get(me)?.handle)} is coming to ${city.split(',')[0]}`,
        body: `Arriving ${formatDate(arriveOn)} for ${nights} night${nights === 1 ? '' : 's'}.`,
        url: `/app/map?user=${me}`,
        refUser: me,
      }),
    )
    .catch((e) => console.error('arrival alerts failed', e));

  return NextResponse.json({ trip });
}

export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await supabaseAdmin!.from('trips').delete().eq('id', id).eq('user_id', g.session.userId);
  return NextResponse.json({ ok: true });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
