import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

/**
 * Live activity heatmap: real current density around the member, from nearby_hotspots (operates on
 * fuzzed public_geo only). No stored table, no stale/empty data — it reflects who is active now.
 */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ cells: [] });

  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get('lat'));
  const lon = Number(sp.get('lon'));
  const radius = Math.min(Math.max(Number(sp.get('radius')) || 25000, 1000), 50000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('nearby_hotspots', {
    center_lat: lat,
    center_lon: lon,
    radius_m: radius,
  });
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  const cells = ((data ?? []) as { lat: number; lon: number; count: number }[]).map((c) => ({
    lat: c.lat,
    lon: c.lon,
    count: Number(c.count),
  }));
  return NextResponse.json({ cells });
}
