import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const Id = z.string().uuid();
const UpdateGroupBody = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    photo: z.string().url().nullable().optional(),
  })
  .strict();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsedId = Id.safeParse(params.id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data: group, error } = await supabaseAdmin
    .from('groups')
    .select(
      `
        id,
        name,
        description,
        location_name,
        photo,
        members_count,
        created_at,
        updated_at,
        group_members (
          user_id,
          joined_at,
          users:users (id, handle, photo, age, gender, verified:age_verified)
        )
      `,
    )
    .eq('id', parsedId.data)
    .single();

  if (error || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  return NextResponse.json({ group }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsedId = Id.safeParse(params.id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateGroupBody.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No valid updates supplied' }, { status: 400 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('groups')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', parsedId.data)
    .eq('creator_id', g.session.userId)
    .select('id,name,description,location_name,photo,members_count,created_at,updated_at')
    .maybeSingle();

  if (error) {
    console.error('update group error:', error.message);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  return NextResponse.json({ group: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsedId = Id.safeParse(params.id);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('groups')
    .delete()
    .eq('id', parsedId.data)
    .eq('creator_id', g.session.userId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('delete group error:', error.message);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
