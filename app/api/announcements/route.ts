import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { isFlagEnabled } from '@/lib/flags/server';

export const dynamic = 'force-dynamic';

/** Live announcements for the signed-in user, newest first. Audience: all | free | paid. */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ announcements: [] });
  if (!supabaseAdmin || !(await isFlagEnabled('announcements', session.userId)))
    return NextResponse.json({ announcements: [] });

  const nowIso = new Date().toISOString();
  const [{ data: me }, { data: rows }] = await Promise.all([
    supabaseAdmin.from('users').select('plan').eq('id', session.userId).maybeSingle(),
    supabaseAdmin
      .from('announcements')
      .select('id, title, body, url, audience, starts_at, ends_at')
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('starts_at', { ascending: false })
      .limit(5),
  ]);
  const paid = me?.plan === 'plus' || me?.plan === 'premium';
  const announcements = (rows ?? []).filter((a) => a.audience === 'all' || (a.audience === 'paid') === paid);
  return NextResponse.json({ announcements });
}
