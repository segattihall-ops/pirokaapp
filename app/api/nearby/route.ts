import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { photoUrl } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

export type NearbyPerson = {
  id: string;
  handle: string;
  lat: number;
  lon: number;
  distanceM: number;
  intent: string | null;
  intentEndsAt: string | null;
  photo: string | null;
  verified: boolean;
  plan: string;
};

/** People with a fresh (24h) fuzzed position within `radius` metres of the given point. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, people: [], hotspots: [] });

  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  const radius = Math.min(Math.max(Number(q.get('radius') ?? 5000), 500), 50000);
  const intent = q.get('intent');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  const [{ data: rows, error }, { data: spots }, { data: tripRows }] = await Promise.all([
    supabaseAdmin.rpc('nearby_users', {
      user_lat: lat,
      user_lon: lon,
      radius_m: Math.round(radius),
      requester_id: session.userId,
      limit_count: 200,
    }),
    supabaseAdmin.rpc('nearby_hotspots', { center_lat: lat, center_lon: lon, radius_m: 25000 }),
    supabaseAdmin.rpc('trips_near', { center_lat: lat, center_lon: lon, radius_m: 50000, requester_id: session.userId }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const people: NearbyPerson[] = (rows ?? [])
    .filter((r: any) => !intent || r.intent === intent)
    .map((r: any) => ({
      id: r.id,
      handle: r.handle,
      lat: r.lat,
      lon: r.lon,
      distanceM: Math.round(r.distance_m),
      intent: r.intent ?? null,
      intentEndsAt: r.intent_ends_at ?? null,
      photo: r.photo_blur_key ? photoUrl(r.photo_blur_key) : null,
      verified: Boolean(r.verified),
      plan: r.plan,
    }));

  const hotspots = (spots ?? []).map((s: any) => ({ lat: s.lat, lon: s.lon, count: Number(s.count) }));
  const visitors: Visitor[] = (tripRows ?? []).map((t: any) => ({
    id: t.user_id,
    handle: t.handle ?? null,
    city: t.city,
    arriveOn: t.arrive_on,
    nights: t.nights,
    photo: t.photo_blur_key ? photoUrl(t.photo_blur_key) : null,
  }));
  return NextResponse.json({ configured: true, people, hotspots, visitors });
}

export type Visitor = { id: string; handle: string | null; city: string; arriveOn: string; nights: number; photo: string | null };
