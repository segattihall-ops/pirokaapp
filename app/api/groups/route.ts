import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const CreateGroupBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  location_name: z.string().trim().min(1).max(200),
  photo: z.string().url().optional(),
});

const ListQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(500).default(50),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  try {
    const parsed = CreateGroupBody.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { name, description, location, location_name, photo } = parsed.data;
    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert({
        creator_id: g.session.userId,
        name,
        description: description || null,
        location: `POINT(${location.lng} ${location.lat})`,
        location_name,
        photo: photo || null,
        members_count: 1,
      })
      .select('id,name,description,location_name,photo,members_count,created_at')
      .single();

    if (error || !data) {
      console.error('create group error:', error?.message);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }

    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: data.id, user_id: g.session.userId });

    if (memberError) {
      await supabaseAdmin.from('groups').delete().eq('id', data.id);
      console.error('create group membership error:', memberError.message);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('create group error:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = ListQuery.safeParse({
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radius: searchParams.get('radius') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid location parameters' }, { status: 400 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    const { lat, lng, radius, limit } = parsed.data;
    const { data, error } = await supabaseAdmin.rpc('nearby_groups', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radius,
      p_limit: limit,
    });

    if (error) {
      console.error('list groups error:', error.message);
      return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 });
    }

    return NextResponse.json(
      { groups: data ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('list groups error:', error);
    return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 });
  }
}
