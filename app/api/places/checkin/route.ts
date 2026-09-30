import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const Body = z.object({ placeId: z.string().uuid(), kind: z.enum(['here', 'going']) });
const TTL_MIN = { here: 240, going: 1440 } as const;

/** "I'm here" lasts 4 h, "Going" 24 h. One active check-in per member (you can only be in one place). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'placeId and kind required' }, { status: 400 });
  const { placeId, kind } = parsed.data;

  const { data: place } = await supabaseAdmin.from('places').select('id').eq('id', placeId).maybeSingle();
  if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  await ensureUserRow(session);
  const expiresAt = new Date(Date.now() + TTL_MIN[kind] * 60_000).toISOString();
  if (kind === 'here') await supabaseAdmin.from('checkins').delete().eq('user_id', session.userId).eq('kind', 'here');
  const { error } = await supabaseAdmin
    .from('checkins')
    .upsert({ user_id: session.userId, place_id: placeId, kind, expires_at: expiresAt }, { onConflict: 'user_id,place_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, kind, expiresAt });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ ok: true });
  const { placeId } = (await request.json().catch(() => ({}))) as { placeId?: string };
  if (!placeId) return NextResponse.json({ error: 'placeId required' }, { status: 400 });
  await supabaseAdmin.from('checkins').delete().eq('user_id', session.userId).eq('place_id', placeId);
  return NextResponse.json({ ok: true });
}
