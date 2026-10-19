import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { isUuid, requireUser } from '@/lib/api/guard';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const Body = z.object({ action: z.enum(['accept', 'decline', 'cancel']) });
const COLS = 'id, conversation_id, proposer_id, invitee_id, place_label, when_text, status, created_at';

/**
 * Respond to a meet proposal. The invitee accepts or declines; the proposer cancels. Only valid while
 * the proposal is still pending.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const { data: p } = await db.from('meet_proposals').select(COLS).eq('id', params.id).maybeSingle();
  if (!p || (p.proposer_id !== me && p.invitee_id !== me))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (p.status !== 'pending')
    return NextResponse.json({ error: 'This proposal was already answered.' }, { status: 409 });

  const action = parsed.data.action;
  if ((action === 'accept' || action === 'decline') && p.invitee_id !== me)
    return NextResponse.json({ error: 'Only the invited member can answer.' }, { status: 403 });
  if (action === 'cancel' && p.proposer_id !== me)
    return NextResponse.json({ error: 'Only the member who proposed can cancel.' }, { status: 403 });

  const nextStatus = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'cancelled';
  const { data, error } = await db
    .from('meet_proposals')
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq('id', p.id)
    .eq('status', 'pending')
    .select(COLS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This proposal was already answered.' }, { status: 409 });

  // Tell the proposer the outcome (decline stays quiet to avoid pressure).
  if (action === 'accept') {
    userCards([me]).then((cards) =>
      notify(p.proposer_id, {
        kind: 'match',
        title: `${displayName(cards.get(me)?.handle)} accepted your meet`,
        body:
          [p.place_label, p.when_text].filter(Boolean).join(' · ') || 'Open the chat to sort out details.',
        url: `/app/chats/${p.conversation_id}`,
        refUser: me,
      }),
    );
  }

  return NextResponse.json({ proposal: data });
}
