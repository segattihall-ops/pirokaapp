import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { matchFor } from '@/lib/taste/learn';

export const dynamic = 'force-dynamic';

const Q = z.object({ userId: z.string().uuid() });

/** Match score for a profile. Premium only; everyone else gets `locked: true` and no number. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const parsed = Q.safeParse({ userId: new URL(request.url).searchParams.get('userId') });
  if (!parsed.success) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  const { data: me } = await supabaseAdmin!.from('users').select('plan').eq('id', g.session.userId).maybeSingle();
  if (me?.plan !== 'premium') return NextResponse.json({ locked: true });
  if (parsed.data.userId === g.session.userId) return NextResponse.json({ locked: false, score: null, reasons: [] });
  const m = await matchFor(g.session.userId, parsed.data.userId);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ locked: false, ...m });
}
