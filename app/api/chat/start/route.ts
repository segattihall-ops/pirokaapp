import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

/** Find or create the 1:1 conversation with another user (by id or handle). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { userId?: string; handle?: string };
  let peerId = body.userId?.trim();
  if (peerId && !/^[0-9a-f-]{36}$/i.test(peerId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  if (body.handle !== undefined && (typeof body.handle !== 'string' || !/^@?[\w.-]{2,24}$/.test(body.handle.trim()))) {
    return NextResponse.json({ error: 'Invalid handle' }, { status: 400 });
  }

  if (!peerId && body.handle) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('handle', body.handle.trim().replace(/^@/, ''))
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    peerId = data?.id;
  }
  if (!peerId) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (peerId === session.userId) return NextResponse.json({ error: 'That is you' }, { status: 400 });

  const me = session.userId;
  const { data: blocked } = await supabaseAdmin
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${peerId},blocked_id.eq.${me}),and(blocker_id.eq.${me},blocked_id.eq.${peerId})`)
    .limit(1);
  if (blocked?.length) return NextResponse.json({ error: 'Not available' }, { status: 403 });

  await ensureUserRow(session);

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .or(`and(a_id.eq.${me},b_id.eq.${peerId}),and(a_id.eq.${peerId},b_id.eq.${me})`)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, created: false });

  const { data: created, error } = await supabaseAdmin
    .from('conversations')
    .insert({ a_id: me, b_id: peerId })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: created.id, created: true });
}
