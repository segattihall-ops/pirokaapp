import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { getConversationForUser, isBlocked, peerOf } from '@/lib/chat/server';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const RING_COOLDOWN_MS = 30_000;
const recent = new Map<string, number>();

/** Push "incoming video call" to the peer so they open the chat where the WebRTC signalling lives. */
export async function POST(_request: Request, { params }: { params: { conversationId: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  const conv = await getConversationForUser(params.conversationId, me);
  if (!conv || !supabaseAdmin) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const peerId = peerOf(conv, me);
  if (await isBlocked(me, peerId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  const key = `${me}:${conv.id}`;
  const last = recent.get(key) ?? 0;
  if (Date.now() - last < RING_COOLDOWN_MS) return NextResponse.json({ ok: true, throttled: true });
  recent.set(key, Date.now());

  const cards = await userCards([me]);
  await notify(peerId, {
    kind: 'call',
    title: `${displayName(cards.get(me)?.handle)} is calling`,
    body: 'Video call — open the chat to answer.',
    url: `/app/chats/${conv.id}`,
    refUser: me,
  });
  return NextResponse.json({ ok: true });
}
