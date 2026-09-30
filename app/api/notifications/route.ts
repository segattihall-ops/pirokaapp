import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

const Patch = z.object({ ids: z.array(z.number().int().positive()).max(200).optional(), all: z.boolean().optional() });

/** Latest 50 notifications + unread count. `?count=1` returns only the count (badge polling). */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const countOnly = new URL(request.url).searchParams.get('count') === '1';
  const { count } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me).is('read_at', null);
  if (countOnly) return NextResponse.json({ unread: count ?? 0 });

  const { data: rows, error } = await db
    .from('notifications')
    .select('id, kind, title, body, url, ref_user, read_at, created_at')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cards = await userCards((rows ?? []).map((r) => r.ref_user).filter(Boolean) as string[]);
  return NextResponse.json({
    unread: count ?? 0,
    notifications: (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title ?? r.body,
      body: r.title ? r.body : '',
      url: r.url,
      user: r.ref_user ? (cards.get(r.ref_user) ?? null) : null,
      read: Boolean(r.read_at),
      at: r.created_at,
    })),
  });
}

/** Mark some (ids) or all notifications read. */
export async function PATCH(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  let q = supabaseAdmin!.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', g.session.userId).is('read_at', null);
  if (!parsed.data.all) {
    if (!parsed.data.ids?.length) return NextResponse.json({ ok: true });
    q = q.in('id', parsed.data.ids);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const g = await requireUser();
  if (g.error) return g.error;
  await supabaseAdmin!.from('notifications').delete().eq('user_id', g.session.userId);
  return NextResponse.json({ ok: true });
}
