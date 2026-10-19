import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser, UUID_RE } from '@/lib/api/guard';
import { getConversationForUser, isBlocked, peerOf } from '@/lib/chat/server';
import { ensureUserRow } from '@/lib/db/users';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';

export const dynamic = 'force-dynamic';

const Body = z.object({
  conversationId: z.string().regex(UUID_RE),
  placeLabel: z.string().trim().max(80).optional(),
  when: z.string().trim().max(80).optional(),
});

const COLS = 'id, conversation_id, proposer_id, invitee_id, place_label, when_text, status, created_at';

/** The latest proposal for a conversation (either direction), so chat can show its state. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const conv = new URL(request.url).searchParams.get('conversation');
  if (!conv || !UUID_RE.test(conv)) return NextResponse.json({ error: 'conversation required' }, { status: 400 });

  const membership = await getConversationForUser(conv, me);
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin!
    .from('meet_proposals')
    .select(COLS)
    .eq('conversation_id', conv)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && isMissingSchema(error)) return NextResponse.json({ proposal: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposal: data ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Propose a meet to the other member of a conversation. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid proposal' }, { status: 400 });

  const conv = await getConversationForUser(parsed.data.conversationId, me);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const invitee = peerOf(conv, me);
  if (await isBlocked(me, invitee)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  await ensureUserRow(g.session);
  const { data, error } = await db
    .from('meet_proposals')
    .insert({
      conversation_id: conv.id,
      proposer_id: me,
      invitee_id: invitee,
      place_label: parsed.data.placeLabel || null,
      when_text: parsed.data.when || null,
      status: 'pending',
    })
    .select(COLS)
    .single();

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'You already have a pending meet in this chat.' }, { status: 409 });
    if (isMissingSchema(error)) return NextResponse.json(schemaPendingResponse('046_meet_proposals'), { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  userCards([me]).then((cards) =>
    notify(invitee, {
      kind: 'match',
      title: `${displayName(cards.get(me)?.handle)} suggested meeting up`,
      body: [parsed.data.placeLabel, parsed.data.when].filter(Boolean).join(' · ') || 'Open the chat to reply.',
      url: `/app/chats/${conv.id}`,
      refUser: me,
    }),
  );

  return NextResponse.json({ proposal: data }, { status: 201 });
}
