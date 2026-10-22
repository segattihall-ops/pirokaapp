import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { blockedIdsFor } from '@/lib/chat/server';

export const dynamic = 'force-dynamic';

/**
 * How many members have signalled interest in me that I have NOT already matched with. Deliberately
 * just a count — no names, no photos, no ids — so the map's "someone nearby is interested" nudge can
 * stay anonymous (the sender is only ever revealed through a mutual like, or the premium "who liked
 * you" screen). People I've already liked back (mutual, revealed) and blocked members are excluded.
 */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  if (!supabaseAdmin) return NextResponse.json({ count: 0 });

  const [incoming, outgoing, blocked] = await Promise.all([
    supabaseAdmin.from('interests').select('from_id').eq('to_id', me).limit(200),
    supabaseAdmin.from('interests').select('to_id').eq('from_id', me).limit(500),
    blockedIdsFor(me),
  ]);
  // Missing schema or a read error → report nothing rather than surfacing a false nudge.
  if (incoming.error) return NextResponse.json({ count: 0 });

  const likedBack = new Set((outgoing.data ?? []).map((r) => r.to_id));
  const admirers = new Set<string>();
  for (const r of incoming.data ?? []) {
    if (r.from_id === me || likedBack.has(r.from_id) || blocked.has(r.from_id)) continue;
    admirers.add(r.from_id);
  }
  return NextResponse.json({ count: admirers.size }, { headers: { 'Cache-Control': 'private, no-store' } });
}
