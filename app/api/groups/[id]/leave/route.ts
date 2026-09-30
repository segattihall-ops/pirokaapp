import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const userId = g.session.userId;

  try {
    const groupId = params.id;
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    // Remove from group
    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (deleteError) return NextResponse.json({ error: 'Not a member' }, { status: 404 });

    // Decrement member count
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('members_count')
      .eq('id', groupId)
      .single();

    if (group && group.members_count > 1) {
      await supabaseAdmin
        .from('groups')
        .update({ members_count: group.members_count - 1, updated_at: new Date().toISOString() })
        .eq('id', groupId);
    } else if (group && group.members_count === 1) {
      // Delete group if last member leaves
      await supabaseAdmin.from('groups').delete().eq('id', groupId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('leave group error:', err);
    return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 });
  }
}
