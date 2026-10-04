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
  intentStartsAt: string | null;
  intentEndsAt: string | null;
  activity: 'active' | 'recent' | 'today';
  photo: string | null;
  verified: boolean;
  plan: string;
};

/**
 * People with a fresh (24h) privacy-fuzzed position within `radius` metres of the given point.
 * The API never reads or returns locations.true_geo.
 */
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
    supabaseAdmin.rpc('trips_near', {
      center_lat: lat,
      center_lon: lon,
      radius_m: 50000,
      requester_id: session.userId,
    }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // nearby_users intentionally exposes only public_geo. Fetch status start times separately so
  // the client can draw a truthful remaining-time ring without widening the location RPC.
  const ids = (rows ?? []).map((r: any) => r.id).filter(Boolean);
  let activeStatuses: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from('statuses')
      .select('user_id, starts_at, ends_at')
      .in('user_id', ids)
      .gt('ends_at', new Date().toISOString());
    activeStatuses = data ?? [];
  }
  const statusOf = new Map(activeStatuses.map((s) => [s.user_id, s]));

  const people: NearbyPerson[] = (rows ?? [])
    .filter((r: any) => !intent || r.intent === intent)
    .map((r: any) => {
      const status = statusOf.get(r.id);
      return {
        id: r.id,
        handle: r.handle,
        lat: r.lat,
        lon: r.lon,
        distanceM: Math.round(r.distance_m),
        intent: r.intent ?? null,
        intentStartsAt: status?.starts_at ?? null,
        intentEndsAt: status?.ends_at ?? r.intent_ends_at ?? null,
        activity: (() => {
          const updated = new Date(r.updated_at ?? 0).getTime();
          const age = Date.now() - updated;
          if (Number.isFinite(updated) && age <= 15 * 60_000) return 'active' as const;
          if (Number.isFinite(updated) && age <= 60 * 60_000) return 'recent' as const;
          return 'today' as const;
        })(),
        photo: r.photo_blur_key ? photoUrl(r.photo_blur_key) : null,
        verified: Boolean(r.verified),
        plan: r.plan,
      };
    });

  const hotspots = (spots ?? []).map((s: any) => ({
    lat: s.lat,
    lon: s.lon,
    count: Number(s.count),
  }));
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

export type Visitor = {
  id: string;
  handle: string | null;
  city: string;
  arriveOn: string;
  nights: number;
  photo: string | null;
};
