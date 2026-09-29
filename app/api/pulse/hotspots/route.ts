import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { lat, lng, radiusMeters = 5000 } = await request.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return Response.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, public_geo', {
        count: 'exact',
      })
      .not('public_geo', 'is', null)
      .lt('mod_step', 'suspend')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Users query error:', error);
      return Response.json({ error: 'Query failed' }, { status: 500 });
    }

    const hotspots = new Map<
      string,
      {
        lat: number;
        lng: number;
        count: number;
        latest: string;
      }
    >();

    (data || []).forEach((user: any) => {
      if (!user.public_geo?.coordinates) return;

      const [lng, lat] = user.public_geo.coordinates;
      const cellKey = `${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;

      if (hotspots.has(cellKey)) {
        const spot = hotspots.get(cellKey)!;
        spot.count++;
      } else {
        hotspots.set(cellKey, {
          lat,
          lng,
          count: 1,
          latest: new Date().toISOString(),
        });
      }
    });

    const spots = Array.from(hotspots.values())
      .filter(s => s.count >= 3)
      .map(s => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [s.lng, s.lat],
        },
        properties: {
          count: s.count,
          intensity: s.count >= 10 ? 'high' : s.count >= 5 ? 'medium' : 'low',
          latest: s.latest,
        },
      }))
      .sort((a, b) => (b.properties.count as number) - (a.properties.count as number))
      .slice(0, 50);

    return Response.json({
      type: 'FeatureCollection',
      features: spots,
    });
  } catch (error) {
    console.error('Hotspots error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
