import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const groupId = params.id;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Check if already a member
    const { data: existing } = await supabaseAdmin
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 });

    // Add member and increment count
    const { error: insertError } = await supabaseAdmin
      .from('group_members')
      .insert([{ group_id: groupId, user_id: userId }]);

    if (insertError) return NextResponse.json({ error: 'Failed to join' }, { status: 500 });

    // Increment member count
    const { data: group, error: updateError } = await supabaseAdmin
      .from('groups')
      .select('members_count')
      .eq('id', groupId)
      .single();

    if (!updateError && group) {
      await supabaseAdmin
        .from('groups')
        .update({ members_count: (group.members_count || 1) + 1, updated_at: new Date().toISOString() })
        .eq('id', groupId);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('join group error:', err);
    return NextResponse.json({ error: 'Failed to join group' }, { status: 500 });
  }
}
