import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const CreateEvent = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  locationName: z.string().trim().min(1).max(100),
  photo: z.string().url().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  category: z.enum(['party', 'meetup', 'sports', 'cultural', 'nightlife', 'other']),
  maxAttendees: z.number().int().positive().optional(),
});

const ListQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(10),
});

export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const parsed = ListQuery.safeParse({
    lat: searchParams.get('lat'),
    lon: searchParams.get('lon'),
    radius: searchParams.get('radius') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid location parameters' }, { status: 400 });
  }

  const { lat, lon, radius } = parsed.data;
  const { data: events, error } = await supabaseAdmin.rpc('nearby_events', {
    user_lat: lat,
    user_lon: lon,
    radius_km: radius,
  });

  if (error) {
    console.error('nearby_events error:', error.message);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }

  const rows = events ?? [];
  const ids = rows.map((event: { id: string }) => event.id);
  const statusByEvent = new Map<string, string>();

  if (ids.length > 0) {
    const { data: mine, error: rsvpError } = await supabaseAdmin
      .from('event_attendees')
      .select('event_id,status')
      .eq('user_id', g.session.userId)
      .in('event_id', ids);

    if (rsvpError) {
      console.error('event RSVP lookup error:', rsvpError.message);
    } else {
      for (const row of mine ?? []) statusByEvent.set(row.event_id, row.status);
    }
  }

  return NextResponse.json(
    {
      events: rows.map((event: Record<string, unknown> & { id: string }) => ({
        ...event,
        my_rsvp_status: statusByEvent.get(event.id) ?? null,
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const parsed = CreateEvent.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const {
    title,
    description,
    location,
    locationName,
    photo,
    startsAt,
    endsAt,
    category,
    maxAttendees,
  } = parsed.data;

  const starts = new Date(startsAt);
  const ends = new Date(endsAt);
  if (ends <= starts) {
    return NextResponse.json({ error: 'endsAt must be after startsAt' }, { status: 400 });
  }
  if (ends.getTime() - starts.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Event duration must be <= 7 days' }, { status: 400 });
  }

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .insert({
      creator_id: g.session.userId,
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
    .select(
      'id,creator_id,title,description,location_name,photo,starts_at,ends_at,category,max_attendees,created_at',
    )
    .single();

  if (error || !event) {
    console.error('create event error:', error?.message);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }

  return NextResponse.json({ event }, { status: 201 });
}
