import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  zip: z.string().optional(),
  lat: z.string().transform(Number).optional(),
  lng: z.string().transform(Number).optional(),
  radius: z.string().transform(Number).default('10'),
  verified: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // searchParams.get() yields null for a missing key, which z.string().optional() rejects — so the
    // directory's bare GET /api/testing-sites used to answer 400. Normalise to undefined.
    const parsed = QuerySchema.safeParse({
      zip: searchParams.get('zip') ?? undefined,
      lat: searchParams.get('lat') ?? undefined,
      lng: searchParams.get('lng') ?? undefined,
      radius: searchParams.get('radius') ?? undefined,
      verified: searchParams.get('verified') ?? undefined,
    });

    if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

    const { zip, lat, lng, radius, verified } = parsed.data;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    let query = supabaseAdmin.from('testing_sites').select('*');

    // Filter by verification status
    if (verified !== undefined) {
      query = query.eq('verified', verified);
    }

    // Filter by zip code
    if (zip) {
      query = query.eq('zip', zip);
    }

    // Filter by proximity (if lat/lng provided)
    if (lat !== undefined && lng !== undefined) {
      // Using simple distance calculation: ~111km per degree
      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

      query = query
        .gte('latitude', lat - latDelta)
        .lte('latitude', lat + latDelta)
        .gte('longitude', lng - lngDelta)
        .lte('longitude', lng + lngDelta);
    }

    const { data, error } = await query
      .order('verified', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ sites: data || [] });
  } catch (err) {
    console.error('testing-sites error:', err);
    return NextResponse.json({ error: 'Failed to fetch testing sites' }, { status: 500 });
  }
}
