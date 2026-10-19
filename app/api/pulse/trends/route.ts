import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

/**
 * Activity trend for the member's coarse (~11 km) cell over the last 24 hourly snapshots. Real data
 * written by /api/cron/pulse-snapshot — never fabricated. Sparse until the cron has run for a while.
 */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ points: [] });

  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get('lat'));
  const lon = Number(sp.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const cellLat = Math.round(lat * 10) / 10;
  const cellLon = Math.round(lon * 10) / 10;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('activity_snapshots')
    .select('bucket, active')
    .eq('cell_lat', cellLat)
    .eq('cell_lon', cellLon)
    .gte('bucket', since)
    .order('bucket', { ascending: true });
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  return NextResponse.json({
    points: (data ?? []).map((r) => ({ bucket: r.bucket as string, active: Number(r.active) })),
  });
}
