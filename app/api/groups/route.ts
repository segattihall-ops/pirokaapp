import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

const CreateGroupBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  location_name: z.string().min(1).max(200),
  photo: z.string().url().optional(),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const body = await request.json();
    const parsed = CreateGroupBody.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { name, description, location, location_name, photo } = parsed.data;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert([
        {
          creator_id: userId,
          name,
          description: description || null,
          location: `POINT(${location.lng} ${location.lat})`,
          location_name,
          photo: photo || null,
          members_count: 1,
        },
      ])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add creator as first member
    await supabaseAdmin.from('group_members').insert([{ group_id: data.id, user_id: userId }]);

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('create group error:', err);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

const ListQuery = z.object({
  lat: z.string().transform(Number),
  lng: z.string().transform(Number),
  radius: z.string().transform(Number).default('50'),
  limit: z.string().transform(Number).default('20'),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = ListQuery.safeParse({
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radius: searchParams.get('radius'),
      limit: searchParams.get('limit'),
    });

    if (!parsed.success) return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });

    const { lat, lng, radius, limit } = parsed.data;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Find groups within radius (ST_DWithin in km)
    const { data, error } = await supabaseAdmin
      .from('groups')
      .select('*')
      .lt(
        'location',
        `POINT(${lng} ${lat}), ${radius * 1000}`, // Convert km to meters
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ groups: data || [] });
  } catch (err) {
    console.error('list groups error:', err);
    return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 });
  }
}
