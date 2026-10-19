import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { effectivePlanNow } from '@/lib/billing/launch';
import { blockedIdsFor } from '@/lib/chat/server';
import { userCards } from '@/lib/users/cards';

export const dynamic = 'force-dynamic';

/**
 * Premium "Who viewed or liked you". Returns the members who liked you (an interest aimed at you that
 * you have not yet seen revealed) and the members who viewed your profile, as small blurred cards.
 * Gated by effective plan, so it unlocks for everyone during launch all-access.
 */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  if (!supabaseAdmin) return NextResponse.json({ locked: false, likes: [], views: [] });

  const { data: meRow } = await supabaseAdmin.from('users').select('plan').eq('id', me).maybeSingle();
  if (effectivePlanNow(meRow?.plan) !== 'premium')
    return NextResponse.json({ locked: true, likes: [], views: [] });

  const [likeRes, viewRes, blocked] = await Promise.all([
    supabaseAdmin.from('interests').select('from_id, created_at').eq('to_id', me).order('created_at', { ascending: false }).limit(60),
    supabaseAdmin.from('profile_views').select('viewer_id, viewed_at').eq('viewee_id', me).order('viewed_at', { ascending: false }).limit(60),
    blockedIdsFor(me),
  ]);

  const likeRows = (likeRes.data ?? []).filter((r) => !blocked.has(r.from_id));
  const viewRows = (viewRes.data ?? []).filter((r) => r.viewer_id !== me && !blocked.has(r.viewer_id));

  const cards = await userCards([...likeRows.map((r) => r.from_id), ...viewRows.map((r) => r.viewer_id)]);

  const likes = likeRows
    .map((r) => {
      const c = cards.get(r.from_id);
      return c ? { ...c, at: r.created_at } : null;
    })
    .filter(Boolean);

  const seen = new Set<string>();
  const views = viewRows
    .map((r) => {
      if (seen.has(r.viewer_id)) return null;
      seen.add(r.viewer_id);
      const c = cards.get(r.viewer_id);
      return c ? { ...c, at: r.viewed_at } : null;
    })
    .filter(Boolean);

  return NextResponse.json(
    { locked: false, likes, views },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
