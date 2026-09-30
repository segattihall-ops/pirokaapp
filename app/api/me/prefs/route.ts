import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

const NOTIF_KEYS =['messages', 'match', 'album', 'arrival', 'status', 'safety'] as const;
type NotifKey = (typeof NOTIF_KEYS)[number];
const DEFAULTS: Record<NotifKey, boolean> = { messages: true, match: true, album: true, arrival: true, status: true, safety: true };

const Patch = z.object(Object.fromEntries(NOTIF_KEYS.map((k) => [k, z.boolean().optional()])) as Record<NotifKey, z.ZodOptional<z.ZodBoolean>>);

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ notif_prefs: DEFAULTS });
  const { data } = await supabaseAdmin.from('users').select('notif_prefs').eq('id', session.userId).maybeSingle();
  return NextResponse.json({ notif_prefs: { ...DEFAULTS, ...((data?.notif_prefs as object) ?? {}) } });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });

  await ensureUserRow(session);
  const { data } = await supabaseAdmin.from('users').select('notif_prefs').eq('id', session.userId).maybeSingle();
  const next = { ...DEFAULTS, ...((data?.notif_prefs as object) ?? {}), ...parsed.data };
  const { error } = await supabaseAdmin.from('users').update({ notif_prefs: next }).eq('id', session.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notif_prefs: next });
}
