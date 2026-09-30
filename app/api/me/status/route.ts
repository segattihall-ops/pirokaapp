import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const INTENTS = ['now', 'tonight', 'hosting', 'visiting', 'looking', 'later'] as const;
const Body = z.object({ intent: z.enum(INTENTS), hours: z.number().min(0.5).max(8).default(2) });

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ status: null });
  const { data } = await supabaseAdmin
    .from('statuses')
    .select('intent, starts_at, ends_at')
    .eq('user_id', session.userId)
    .gt('ends_at', new Date().toISOString())
    .maybeSingle();
  return NextResponse.json({ status: data ?? null });
}

/** Sets "what I'm up to" for up to 8 hours. Replaces any current status. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const { intent, hours } = parsed.data;

  await ensureUserRow(session);
  const now = new Date();
  const row = {
    user_id: session.userId,
    intent,
    starts_at: now.toISOString(),
    ends_at: new Date(now.getTime() + hours * 3600_000).toISOString(),
    warned: false,
  };
  const { error } = await supabaseAdmin.from('statuses').upsert(row, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: { intent, starts_at: row.starts_at, ends_at: row.ends_at } });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ status: null });
  await supabaseAdmin.from('statuses').delete().eq('user_id', session.userId);
  return NextResponse.json({ status: null });
}
