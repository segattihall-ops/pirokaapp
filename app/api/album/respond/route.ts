import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser, UUID_RE } from '@/lib/api/guard';
import { notify } from '@/lib/notify/server';
import { displayName, userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().regex(UUID_RE), action: z.enum(['accept', 'decline', 'revoke', 'grant']) });

/**
 * Owner's decision on their album:
 * accept / decline answer a pending request; grant opens it unasked; revoke closes it again.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { userId, action } = parsed.data;
  if (userId === me) return NextResponse.json({ error: 'That is you' }, { status: 400 });
  const now = new Date().toISOString();

  if (action === 'accept' || action === 'grant') {
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      db.from('album_grants').upsert({ owner_id: me, grantee_id: userId, granted_at: now, revoked_at: null }, { onConflict: 'owner_id,grantee_id' }),
      db.from('album_requests').update({ status: 'accepted', decided_at: now }).eq('from_id', userId).eq('to_id', me),
    ]);
    if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
    const cards = await userCards([me]);
    notify(userId, {
      kind: 'album_grant',
      title: `${displayName(cards.get(me)?.handle)} unlocked their album for you`,
      body: 'Open their profile to see it.',
      url: `/app/map?user=${me}`,
      refUser: me,
    });
    return NextResponse.json({ state: 'granted' });
  }

  if (action === 'decline') {
    const { error } = await db.from('album_requests').update({ status: 'declined', decided_at: now }).eq('from_id', userId).eq('to_id', me).eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ state: 'declined' });
  }

  // revoke
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    db.from('album_grants').update({ revoked_at: now }).eq('owner_id', me).eq('grantee_id', userId).is('revoked_at', null),
    db.from('album_requests').delete().eq('from_id', userId).eq('to_id', me),
  ]);
  if (e1 || e2) return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  return NextResponse.json({ state: 'revoked' });
}
