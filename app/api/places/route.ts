import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const PLACE_KINDS =['bar', 'club', 'cafe', 'restaurant', 'gym', 'park', 'beach', 'sauna', 'shop', 'venue', 'other'] as const;

export type Place = {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  lat: number;
  lon: number;
  distanceM: number;
  verified: boolean;
  peakHint: string | null;
  here: number;
  going: number;
  my: { kind: 'here' | 'going'; expiresAt: string } | null;
};

/** Venues within `radius` metres with live check-in counts. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, places: [] });

  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  const radius = Math.min(Math.max(Number(q.get('radius') ?? 10000), 500), 50000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('nearby_places', {
    user_lat: lat,
    user_lon: lon,
    radius_m: Math.round(radius),
    requester_id: session.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const places: Place[] = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    address: r.address ?? null,
    lat: r.lat,
    lon: r.lon,
    distanceM: Math.round(r.distance_m),
    verified: Boolean(r.verified),
    peakHint: r.peak_hint ?? null,
    here: Number(r.here_count ?? 0),
    going: Number(r.going_count ?? 0),
    my: r.my_kind ? { kind: r.my_kind, expiresAt: r.my_expires_at } : null,
  }));
  return NextResponse.json({ configured: true, places });
}

const Suggest = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(PLACE_KINDS),
  address: z.string().trim().max(160).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Members can suggest a venue; it appears immediately as unverified until an admin verifies it. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Suggest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid place' }, { status: 400 });
  const { name, kind, address, lat, lng } = parsed.data;

  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await supabaseAdmin
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', session.userId)
    .gte('created_at', dayAgo);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: 'You can suggest up to 5 places a day' }, { status: 429 });

  await ensureUserRow(session);
  const { data, error } = await supabaseAdmin
    .from('places')
    .insert({ name, kind, address: address || null, geo: `POINT(${lng} ${lat})`, verified: false, created_by: session.userId })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
