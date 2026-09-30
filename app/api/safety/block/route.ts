import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const Body = z.object({ targetId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'targetId required' }, { status: 400 });
  const { targetId } = parsed.data;
  if (targetId === session.userId) return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });

  await ensureUserRow(session);
  const { error } = await supabaseAdmin
    .from('blocks')
    .upsert({ blocker_id: session.userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'block.add',
    target: targetId,
    target_user_id: targetId,
    details: null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'targetId required' }, { status: 400 });

  await supabaseAdmin
    .from('blocks')
    .delete()
    .eq('blocker_id', session.userId)
    .eq('blocked_id', parsed.data.targetId);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ blocked: [] });
  const { data } = await supabaseAdmin
    .from('blocks')
    .select('blocked_id, created_at, user:users!blocks_blocked_id_fkey(handle)')
    .eq('blocker_id', session.userId);
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { handle: string | null } | null;
  return NextResponse.json({
    blocked: (data ?? []).map((b) => ({ id: b.blocked_id, handle: one(b.user)?.handle ?? null, at: b.created_at })),
  });
}
