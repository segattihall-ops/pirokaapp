import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { haveConversation, isBlocked } from '@/lib/chat/server';
import { photoUrl } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

/** Public profile as another member sees it. Album photos stay blurred until an album grant exists. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const id = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  if (id !== session.userId && (await isBlocked(session.userId, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ data: u }, { data: photos }, { data: status }, { data: grant }, conversation, { data: request }, { data: fav }, { data: trips }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, handle, pronouns, gender, orientation, communities, bio, verified_at, plan, visibility, deleted_at, mod_step')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin.from('photos').select('slot, storage_key, blur_key').eq('user_id', id).order('slot'),
    supabaseAdmin.from('statuses').select('intent, ends_at').eq('user_id', id).gt('ends_at', new Date().toISOString()).maybeSingle(),
    supabaseAdmin
      .from('album_grants')
      .select('granted_at')
      .eq('owner_id', id)
      .eq('grantee_id', session.userId)
      .is('revoked_at', null)
      .maybeSingle(),
    haveConversation(session.userId, id),
    supabaseAdmin.from('album_requests').select('status').eq('from_id', session.userId).eq('to_id', id).maybeSingle(),
    supabaseAdmin.from('favorites').select('alerts').eq('user_id', session.userId).eq('fav_id', id).maybeSingle(),
    supabaseAdmin.from('trips').select('city, arrive_on, nights').eq('user_id', id).gte('arrive_on', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)).order('arrive_on').limit(3),
  ]);

  if (!u || u.deleted_at || (u.mod_step && ['suspended', 'removed'].includes(u.mod_step))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const self = id === session.userId;
  const unlocked = self || Boolean(grant);
  // Main photo clears once you are talking; the album (slots 1-5) needs an explicit grant.
  const mainClear = unlocked || conversation;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (trips ?? []).filter((t) => addDays(t.arrive_on, t.nights) >= today);
  return NextResponse.json({
    id: u.id,
    handle: u.handle,
    pronouns: u.pronouns ?? [],
    gender: u.gender ?? [],
    orientation: u.orientation ?? [],
    communities: u.communities ?? [],
    bio: u.bio ?? null,
    verified: Boolean(u.verified_at),
    plan: u.plan,
    intent: status?.intent ?? null,
    intentEndsAt: status?.ends_at ?? null,
    photos: (photos ?? []).map((p) => {
      const clear = p.slot === 0 ? mainClear : unlocked;
      return { slot: p.slot, url: photoUrl(clear ? p.storage_key : p.blur_key), blurred: !clear };
    }),
    albumUnlocked: unlocked,
    albumRequest: self ? 'self' : grant ? 'unlocked' : (request?.status ?? 'none'),
    favorite: Boolean(fav),
    favoriteAlerts: fav?.alerts ?? true,
    trips: upcoming.map((t) => ({ city: t.city, arriveOn: t.arrive_on, nights: t.nights })),
    conversation,
  });
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
