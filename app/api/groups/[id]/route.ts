import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const groupId = params.id;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { data: group, error } = await supabaseAdmin
      .from('groups')
      .select(
        `
        *,
        group_members (
          user_id,
          joined_at,
          users:users (id, handle, photo, age, gender, verified:age_verified)
        )
      `,
      )
      .eq('id', groupId)
      .single();

    if (error) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    return NextResponse.json({ group });
  } catch (err) {
    console.error('get group error:', err);
    return NextResponse.json({ error: 'Failed to get group' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const groupId = params.id;
    const body = await request.json();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Only allow updating name, description, photo
    const updates: Record<string, any> = {};
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.photo) updates.photo = body.photo;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    return NextResponse.json({ group: data });
  } catch (err) {
    console.error('update group error:', err);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const groupId = params.id;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const { error } = await supabaseAdmin.from('groups').delete().eq('id', groupId);

    if (error) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete group error:', err);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
