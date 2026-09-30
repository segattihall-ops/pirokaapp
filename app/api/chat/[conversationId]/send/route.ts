import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getConversationForUser, getHandle, peerOf } from '@/lib/chat/server';
import { sendPushToUser } from '@/lib/push/server';

export const dynamic = 'force-dynamic';

const MAX_ENVELOPE_BYTES = 64 * 1024;

/** Stores an opaque Signal envelope. The server never sees plaintext. */
export async function POST(request: Request, { params }: { params: { conversationId: string } }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const conv = await getConversationForUser(params.conversationId, session.userId);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { ciphertext, kind = 'text' } = (await request.json().catch(() => ({}))) as {
    ciphertext?: string;
    kind?: string;
  };
  if (!ciphertext || typeof ciphertext !== 'string' || !/^\\x[0-9a-f]+$/i.test(ciphertext)) {
    return NextResponse.json({ error: 'ciphertext must be hex bytea' }, { status: 400 });
  }
  if (ciphertext.length > MAX_ENVELOPE_BYTES * 2) return NextResponse.json({ error: 'Too large' }, { status: 413 });

  const { data, error } = await supabaseAdmin
    .from('dm_messages')
    .insert({ conversation_id: conv.id, sender_id: session.userId, ciphertext, kind })
    .select('id, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const peerId = peerOf(conv, session.userId);
  getHandle(session.userId)
    .then((handle) =>
      sendPushToUser(peerId, {
        title: handle ? `@${handle}` : 'New message',
        body: 'Sent you an encrypted message',
        url: `/app/chats/${conv.id}`,
        tag: `chat-${conv.id}`,
      }),
    )
    .catch((e) => console.error('push failed', e));

  return NextResponse.json({ id: data.id, created_at: data.created_at });
}
