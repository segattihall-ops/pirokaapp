import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { isUuid, requireUser } from '@/lib/api/guard';
import { MEET_COLUMNS as COLS, publicMeet } from '@/lib/meet/server';

export const dynamic = 'force-dynamic';

const Body = z.object({ action: z.enum(['checkin', 'extend', 'end', 'alert', 'cancel']) });

/** Owner actions on a SafeMeet. Only the person who started it can act on it. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const { data: m } = await db.from('meets').select(COLS).eq('id', params.id).eq('a_id', me).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const live = m.status === 'active' || m.status === 'alert';
  const now = new Date();
  let patch: Record<string, unknown> = {};

  switch (parsed.data.action) {
    case 'checkin':
      if (!live) return NextResponse.json({ error: 'This SafeMeet is over' }, { status: 409 });
      patch = {
        status: 'active',
        last_checkin_at: now.toISOString(),
        next_checkin_at: new Date(now.getTime() + m.checkin_every * 60_000).toISOString(),
        reminded_at: null,
        alert_at: null,
        checkins: (m.checkins ?? 0) + 1,
      };
      break;
    case 'extend':
      if (!live) return NextResponse.json({ error: 'This SafeMeet is over' }, { status: 409 });
      patch = { ends_at: new Date(Math.max(now.getTime(), new Date(m.ends_at ?? now).getTime()) + 60 * 60_000).toISOString() };
      break;
    case 'alert':
      if (!live) return NextResponse.json({ error: 'This SafeMeet is over' }, { status: 409 });
      patch = { status: 'alert', alert_at: now.toISOString() };
      break;
    case 'end':
      patch = { status: 'ended', ended_at: now.toISOString(), last_checkin_at: now.toISOString() };
      break;
    case 'cancel':
      patch = { status: 'cancelled', ended_at: now.toISOString() };
      break;
  }

  const { data, error } = await db.from('meets').update(patch).eq('id', m.id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meet: publicMeet(data, me) });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { data: m } = await supabaseAdmin!.from('meets').select(COLS).eq('id', params.id).or(`a_id.eq.${me},b_id.eq.${me}`).maybeSingle();
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ meet: publicMeet(m, me) });
}
