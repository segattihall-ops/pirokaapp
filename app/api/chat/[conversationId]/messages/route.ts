import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getConversationForUser } from '@/lib/chat/server';

export const dynamic = 'force-dynamic';

/** History (ascending). `after=<iso>` returns only newer rows — used as the polling fallback when realtime is down. */
export async function GET(request: Request, { params }: { params: { conversationId: string } }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const conv = await getConversationForUser(params.conversationId, session.userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 200);
  const before = url.searchParams.get('before');
  const after = url.searchParams.get('after');

  let q = supabaseAdmin
    .from('dm_messages')
    .select('id, sender_id, ciphertext, kind, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  if (after) q = q.gt('created_at', after);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
