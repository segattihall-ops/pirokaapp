import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { isUuid, requireUser } from '@/lib/api/guard';
import { isBlocked } from '@/lib/chat/server';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const RETRY_AFTER_DECLINE_MS = 7 * 24 * 3600_000;

/** Ask someone to unlock their private album. One open request per pair; a decline blocks re-asking for a week. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const { userId } = (await request.json().catch(() => ({}))) as { userId?: unknown };
  if (!isUuid(userId)) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (userId === me) return NextResponse.json({ error: 'That is you' }, { status: 400 });
  if (await isBlocked(me, userId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  const [{ data: grant }, { data: existing }] = await Promise.all([
    db.from('album_grants').select('granted_at').eq('owner_id', userId).eq('grantee_id', me).is('revoked_at', null).maybeSingle(),
    db.from('album_requests').select('status, created_at, decided_at').eq('from_id', me).eq('to_id', userId).maybeSingle(),
  ]);
  if (grant) return NextResponse.json({ state: 'unlocked' });
  if (existing?.status === 'pending') return NextResponse.json({ state: 'pending' });
  if (existing?.status === 'declined') {
    const since = Date.now() - new Date(existing.decided_at ?? existing.created_at).getTime();
    if (since < RETRY_AFTER_DECLINE_MS) return NextResponse.json({ state: 'declined' });
  }

  const { error } = await db
    .from('album_requests')
    .upsert({ from_id: me, to_id: userId, status: 'pending', created_at: new Date().toISOString(), decided_at: null }, { onConflict: 'from_id,to_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cards = await userCards([me]);
  notify(userId, {
    kind: 'album_request',
    title: `${displayName(cards.get(me)?.handle)} wants to see your album`,
    body: 'Accept or decline from Me → Album requests.',
    url: '/app/me#album',
    refUser: me,
  });
  return NextResponse.json({ state: 'pending' });
}
