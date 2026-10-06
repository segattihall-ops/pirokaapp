import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getConversationForUser } from '@/lib/chat/server';

export const dynamic = 'force-dynamic';

/** Get all replies to a specific message (thread). */
export async function GET(request: Request, { params }: { params: { conversationId: string } }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(request.url);
  const messageId = url.searchParams.get('messageId');
  if (!messageId || !/^\d+$/.test(messageId)) {
    return NextResponse.json({ error: 'messageId required' }, { status: 400 });
  }

  const conv = await getConversationForUser(params.conversationId, session.userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('dm_messages')
    .select('id, sender_id, created_at, parent_message_id')
    .eq('conversation_id', params.conversationId)
    .eq('parent_message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data ?? [] });
}
