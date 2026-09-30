import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export type GeoHit = { name: string; lat: number; lon: number };

const UA = 'piroka-app/1.0 (travel mode; support@piroka.app)';

async function photon(q: string): Promise<GeoHit[]> {
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 0 },
  });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  const j = (await r.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
  return (j.features ?? [])
    .filter((f) => ['city', 'town', 'village', 'locality', 'district', 'state', 'country', 'county'].includes(f.properties.type ?? f.properties.osm_value ?? ''))
    .map((f) => ({
      name: [f.properties.name, f.properties.state, f.properties.country].filter(Boolean).join(', '),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
}

async function nominatim(q: string): Promise<GeoHit[]> {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&featuretype=city&q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    next: { revalidate: 0 },
  });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return j.map((h) => ({ name: h.display_name.split(', ').filter((_, i, a) => i === 0 || i >= a.length - 2).join(', '), lat: Number(h.lat), lon: Number(h.lon) }));
}

/** City search for travel mode. Server-side so the geocoders see one identified client, not every phone. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const seen = new Set<string>();
  const dedupe = (hits: GeoHit[]) => hits.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && !seen.has(h.name) && seen.add(h.name));
  try {
    const hits = dedupe(await photon(q));
    if (hits.length) return NextResponse.json({ hits: hits.slice(0, 5) });
  } catch (e) {
    console.warn('photon failed', e instanceof Error ? e.message : e);
  }
  try {
    return NextResponse.json({ hits: dedupe(await nominatim(q)).slice(0, 5) });
  } catch (e) {
    console.warn('nominatim failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ hits: [], error: 'City search is unavailable right now' }, { status: 502 });
  }
}
