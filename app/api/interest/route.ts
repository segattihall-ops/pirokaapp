import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { isBlocked } from '@/lib/chat/server';
import { notify } from '@/lib/notify/server';
import { userCards, displayName } from '@/lib/users/cards';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import { track } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';

const Body = z.object({ userId: z.string().uuid() });

/**
 * "Interested" (profile action). The target is told only that someone nearby is interested. When
 * the target has already signalled back, both members are told it's mutual and see each other.
 */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const target = parsed.data.userId;
  if (target === me) return NextResponse.json({ error: 'That is you.' }, { status: 400 });
  await ensureUserRow(g.session);

  const db = supabaseAdmin!;
  const { data: t } = await db
    .from('users')
    .select('id, handle, deleted_at, mod_step')
    .eq('id', target)
    .maybeSingle();
  if (!t || t.deleted_at || (t.mod_step && ['suspended', 'removed'].includes(t.mod_step)))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (await isBlocked(me, target)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error: insErr } = await db
    .from('interests')
    .upsert({ from_id: me, to_id: target }, { onConflict: 'from_id,to_id', ignoreDuplicates: true });
  if (insErr) {
    if (isMissingSchema(insErr)) return NextResponse.json(schemaPendingResponse('042_interests'), { status: 503 });
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const { data: back } = await db
    .from('interests')
    .select('from_id')
    .eq('from_id', target)
    .eq('to_id', me)
    .maybeSingle();

  if (back) {
    const cards = await userCards([me, target]);
    const myName = displayName(cards.get(me)?.handle);
    const theirName = displayName(cards.get(target)?.handle);
    await Promise.all([
      notify(target, {
        kind: 'match',
        title: "It's mutual",
        body: `${myName} is interested too. Say hi.`,
        url: '/app/chats',
        refUser: me,
      }),
      notify(me, {
        kind: 'match',
        title: "It's mutual",
        body: `You and ${theirName} are interested in each other.`,
        url: '/app/chats',
        refUser: target,
      }),
    ]);
    void track({ userId: me, event: 'mutual_match', props: {} });
    return NextResponse.json({
      mutual: true,
      reveal: { id: target, handle: t.handle ?? null, name: theirName },
    });
  }

  // Anonymous to the target: no name, no photo, no ref to the sender.
  await notify(target, {
    kind: 'match',
    title: 'Someone nearby is interested',
    body: 'They will see you if you like them back.',
    url: '/app/map',
    refUser: null,
  });
  return NextResponse.json({ mutual: false });
}

/** Remove my signal. Doesn't notify anyone. */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const target = new URL(request.url).searchParams.get('userId');
  if (!target || !/^[0-9a-f-]{36}$/i.test(target)) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  await supabaseAdmin!.from('interests').delete().eq('from_id', g.session.userId).eq('to_id', target);
  return NextResponse.json({ ok: true });
}
