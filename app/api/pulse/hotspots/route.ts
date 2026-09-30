import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** Hotspots (≥3 people per ~150 m geohash cell) within 25 km, as GeoJSON. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ type: 'FeatureCollection', features: [] });

  const { lat, lng, radiusMeters = 25000 } = (await request.json().catch(() => ({}))) as {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
  };
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('nearby_hotspots', {
    center_lat: lat,
    center_lon: lng,
    radius_m: Math.min(Math.max(Math.round(radiusMeters), 1000), 50000),
  });
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  return NextResponse.json({
    type: 'FeatureCollection',
    features: (data ?? []).map((s: { lat: number; lon: number; count: number }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { count: Number(s.count), intensity: s.count >= 10 ? 'high' : s.count >= 5 ? 'medium' : 'low' },
    })),
  });
}
