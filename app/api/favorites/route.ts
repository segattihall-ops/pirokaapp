import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser, UUID_RE } from '@/lib/api/guard';
import { blockedIdsFor, isBlocked } from '@/lib/chat/server';
import { userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const MAX_FAVORITES = 200;
const Body = z.object({ userId: z.string().regex(UUID_RE), alerts: z.boolean().optional() });

/** My favourites, live ones first. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  const [{ data: rows }, blocked] = await Promise.all([
    supabaseAdmin!
      .from('favorites')
      .select('fav_id, alerts, created_at')
      .eq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(MAX_FAVORITES),
    blockedIdsFor(me),
  ]);
  const visible = (rows ?? []).filter((r) => !blocked.has(r.fav_id));
  const cards = await userCards(visible.map((r) => r.fav_id));
  const favorites = visible
    .filter((r) => cards.has(r.fav_id))
    .map((r) => ({ ...cards.get(r.fav_id)!, alerts: r.alerts, since: r.created_at }))
    .sort((a, b) => Number(Boolean(b.intent)) - Number(Boolean(a.intent)));
  return NextResponse.json({ favorites });
}

/** Add (or update alerts for) a favourite. Quietly one-directional: the other person is not told. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { userId, alerts = true } = parsed.data;
  if (userId === me) return NextResponse.json({ error: 'That is you' }, { status: 400 });
  if (await isBlocked(me, userId)) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  const { count } = await supabaseAdmin!
    .from('favorites')
    .select('fav_id', { count: 'exact', head: true })
    .eq('user_id', me);
  if ((count ?? 0) >= MAX_FAVORITES)
    return NextResponse.json({ error: `Up to ${MAX_FAVORITES} favourites` }, { status: 409 });

  const { error } = await supabaseAdmin!
    .from('favorites')
    .upsert({ user_id: me, fav_id: userId, alerts }, { onConflict: 'user_id,fav_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorite: true, alerts });
}

export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!userId || !UUID_RE.test(userId))
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await supabaseAdmin!.from('favorites').delete().eq('user_id', g.session.userId).eq('fav_id', userId);
  return NextResponse.json({ favorite: false });
}
