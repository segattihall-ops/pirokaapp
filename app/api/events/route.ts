import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const CreateEvent = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.object({ lat: z.number(), lon: z.number() }),
  locationName: z.string().min(1).max(100),
  photo: z.string().url().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  category: z.enum(['party', 'meetup', 'sports', 'cultural', 'nightlife', 'other']),
  maxAttendees: z.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = searchParams.get('radius') || '10'; // km

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const radiusKm = Math.max(1, Math.min(50, parseInt(radius, 10)));

  const { data: events, error } = await supabaseAdmin.rpc('nearby_events', {
    user_lat: parseFloat(lat),
    user_lon: parseFloat(lon),
    radius_km: radiusKm,
  });

  if (error) {
    console.error('nearby_events error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: events || [] });
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  const body = await request.json();
  const parsed = CreateEvent.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { title, description, location, locationName, photo, startsAt, endsAt, category, maxAttendees } = parsed.data;

  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (ends <= starts) return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  if (ends.getTime() - starts.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Event duration must be <= 7 days' }, { status: 400 });
  }

  const db = supabaseAdmin!;
  const { data: event, error } = await db
    .from('events')
    .insert({
      creator_id: me,
      title,
      description: description || null,
      location: `POINT(${location.lon} ${location.lat})`,
      location_name: locationName,
      photo: photo || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      category,
      max_attendees: maxAttendees || null,
    })
    .select()
    .single();

  if (error) {
    console.error('create event error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event }, { status: 201 });
}
