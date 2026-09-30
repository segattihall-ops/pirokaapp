import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { blockedIdsFor } from '@/lib/chat/server';
import { userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

/** Inbox for my album: who is asking, and who I have let in. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const [{ data: incoming }, { data: grants }, blocked] = await Promise.all([
    db.from('album_requests').select('from_id, created_at').eq('to_id', me).eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    db.from('album_grants').select('grantee_id, granted_at').eq('owner_id', me).is('revoked_at', null).order('granted_at', { ascending: false }).limit(200),
    blockedIdsFor(me),
  ]);

  const req = (incoming ?? []).filter((r) => !blocked.has(r.from_id));
  const gr = (grants ?? []).filter((r) => !blocked.has(r.grantee_id));
  const cards = await userCards([...req.map((r) => r.from_id), ...gr.map((r) => r.grantee_id)]);

  return NextResponse.json({
    requests: req.filter((r) => cards.has(r.from_id)).map((r) => ({ user: cards.get(r.from_id), at: r.created_at })),
    grants: gr.filter((r) => cards.has(r.grantee_id)).map((r) => ({ user: cards.get(r.grantee_id), at: r.granted_at })),
  });
}
