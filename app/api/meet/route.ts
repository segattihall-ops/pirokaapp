import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser, UUID_RE } from '@/lib/api/guard';
import { getConversationForUser, isBlocked, peerOf } from '@/lib/chat/server';
import { ensureUserRow } from '@/lib/db/users';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';
import { CHECKIN_OPTIONS, ETA_OPTIONS } from '@/lib/meet/shared';
import { MEET_COLUMNS, publicMeet } from '@/lib/meet/server';

export const dynamic = 'force-dynamic';

const Body = z.object({
  conversationId: z.string().regex(UUID_RE),
  meetType: z.enum(['public', 'a_place', 'b_place']),
  etaMinutes: z.number().int().refine((v) => ETA_OPTIONS.includes(v)),
  checkinEvery: z.number().int().refine((v) => CHECKIN_OPTIONS.includes(v)),
  boundaries: z.string().trim().max(280).optional(),
  placeLabel: z.string().trim().max(80).optional(),
  trustedContact: z.object({ name: z.string().trim().min(1).max(60), phone: z.string().trim().max(40).optional() }).optional(),
});

/** My meets: the active/alert one first, then the last few. `?conversation=` narrows to one chat. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const conv = new URL(request.url).searchParams.get('conversation');

  let q = supabaseAdmin!.from('meets').select(MEET_COLUMNS).or(`a_id.eq.${me},b_id.eq.${me}`).order('started_at', { ascending: false }).limit(10);
  if (conv && UUID_RE.test(conv)) q = q.eq('conversation_id', conv);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meets = (data ?? []).map((m) => publicMeet(m, me));
  const cards = await userCards(meets.map((m) => m.peerId));
  return NextResponse.json({
    active: meets.find((m) => m.status === 'active' || m.status === 'alert') ?? null,
    meets: meets.map((m) => ({ ...m, peer: cards.get(m.peerId) ?? null })),
  });
}

/**
 * Start a SafeMeet for a chat. One active meet per person. The peer is told a SafeMeet exists (and the
 * boundaries, since they are meant to be read), but never sees the trusted contact or the share link.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid SafeMeet' }, { status: 400 });
  const b = parsed.data;

  const conv = await getConversationForUser(b.conversationId, me);
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const peerId = peerOf(conv, me);
  if (await isBlocked(me, peerId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  const { data: existing } = await db.from('meets').select('id').eq('a_id', me).in('status', ['active', 'alert']).limit(1);
  if (existing?.length) return NextResponse.json({ error: 'You already have an active SafeMeet. End it first.' }, { status: 409 });

  await ensureUserRow(g.session);
  const now = new Date();
  const row = {
    a_id: me,
    b_id: peerId,
    conversation_id: conv.id,
    meet_type: b.meetType,
    eta_minutes: b.etaMinutes,
    checkin_every: b.checkinEvery,
    boundaries: b.boundaries || null,
    place_label: b.placeLabel || null,
    trusted_contact: b.trustedContact ? { name: b.trustedContact.name, phone: b.trustedContact.phone || null } : null,
    status: 'active',
    share_token: randomBytes(18).toString('base64url'),
    accepted_at: now.toISOString(),
    started_at: now.toISOString(),
    ends_at: new Date(now.getTime() + b.etaMinutes * 60_000).toISOString(),
    last_checkin_at: now.toISOString(),
    next_checkin_at: new Date(now.getTime() + b.checkinEvery * 60_000).toISOString(),
    checkins: 0,
  };
  const { data, error } = await db.from('meets').insert(row).select(MEET_COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  userCards([me]).then((cards) =>
    notify(peerId, {
      kind: 'safety',
      title: `${displayName(cards.get(me)?.handle)} set up a SafeMeet with you`,
      body: b.boundaries ? `Boundaries: ${b.boundaries.slice(0, 120)}` : 'Timed check-ins are on for this meet.',
      url: `/app/chats/${conv.id}`,
      refUser: me,
    }),
  );

  return NextResponse.json({ meet: publicMeet(data, me) });
}
