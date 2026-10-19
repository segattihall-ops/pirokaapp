import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { haveConversation, isBlocked } from '@/lib/chat/server';
import { photoUrl } from '@/lib/upload/storage';
import { addTripDays } from '@/lib/map/pin-anatomy';
import { isMissingSchema } from '@/lib/db/schema-errors';
import { canRevealMainPhoto } from '@/lib/profile/photo-visibility';

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

  const [
    { data: u },
    { data: photos },
    { data: status },
    { data: grant },
    conversation,
    { data: request },
    { data: fav },
    initialTrips,
  ] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select(
        'id, handle, pronouns, gender, orientation, communities, origin, bio, verified_at, plan, visibility, deleted_at, mod_step',
      )
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin.from('photos').select('slot, storage_key, blur_key').eq('user_id', id).order('slot'),
    supabaseAdmin
      .from('statuses')
      .select('intent, ends_at')
      .eq('user_id', id)
      .gt('ends_at', new Date().toISOString())
      .maybeSingle(),
    supabaseAdmin
      .from('album_grants')
      .select('granted_at')
      .eq('owner_id', id)
      .eq('grantee_id', session.userId)
      .is('revoked_at', null)
      .maybeSingle(),
    haveConversation(session.userId, id),
    supabaseAdmin
      .from('album_requests')
      .select('status')
      .eq('from_id', session.userId)
      .eq('to_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('favorites')
      .select('alerts')
      .eq('user_id', session.userId)
      .eq('fav_id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('trips')
      .select('city, arrive_on, nights, arrival_time, departure_on, departure_time')
      .eq('user_id', id)
      .gte('arrive_on', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
      .order('arrive_on')
      .limit(3),
  ]);

  if (!u || u.deleted_at || (u.mod_step && ['suspended', 'removed'].includes(u.mod_step))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let trips = initialTrips.data ?? [];
  if (initialTrips.error && isMissingSchema(initialTrips.error)) {
    const legacy = await supabaseAdmin.from('trips').select('city, arrive_on, nights')
      .eq('user_id', id)
      .gte('arrive_on', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
      .order('arrive_on').limit(3);
    if (!legacy.error) {
      trips = (legacy.data ?? []).map((t) => ({
        ...t, arrival_time: null, departure_on: null, departure_time: null,
      }));
    }
  }
  const self = id === session.userId;
  const unlocked = self || Boolean(grant);
  // An album grant is not equivalent to consent to reveal the original main photo.
  // Chat only reduces the rendered blur; only mutual/accepted active Meet can reveal it.
  let mainClear = self;
  if (!self) {
    const pair = `and(a_id.eq.${session.userId},b_id.eq.${id}),and(a_id.eq.${id},b_id.eq.${session.userId})`;
    const nowIso = new Date().toISOString();
    const [mutual, meet, risk] = await Promise.all([
      supabaseAdmin.from('conversations').select('id').or(pair).eq('mutual', true).limit(1),
      supabaseAdmin.from('meets').select('id').or(pair)
        .not('accepted_at', 'is', null).gt('ends_at', nowIso).eq('status', 'active').limit(1),
      supabaseAdmin.from('locations').select('user_id, risk_region')
        .in('user_id', [session.userId, id]),
    ]);
    // Missing location safety information or query errors must never reveal a clear photo.
    if (!mutual.error && !meet.error && !risk.error) {
      const riskOf = new Map((risk.data ?? []).map((r) => [r.user_id, Boolean(r.risk_region)]));
      mainClear = canRevealMainPhoto({
        self: false,
        mutual: (mutual.data?.length ?? 0) > 0,
        activeAcceptedMeet: (meet.data?.length ?? 0) > 0,
        viewerRisk: riskOf.get(session.userId) ?? null,
        peerRisk: riskOf.get(id) ?? null,
      });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (trips ?? []).filter((t) => (t.departure_on ?? addTripDays(t.arrive_on, t.nights)) >= today);
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
    originCode: u.origin ?? null,
    intent: status?.intent ?? null,
    intentEndsAt: status?.ends_at ?? null,
    photos: await Promise.all(
      (photos ?? []).map(async (p) => {
        const clear = p.slot === 0 ? mainClear : unlocked;
        return { slot: p.slot, url: await photoUrl(clear ? p.storage_key : p.blur_key), blurred: !clear };
      }),
    ),
    albumUnlocked: unlocked,
    albumRequest: self ? 'self' : grant ? 'unlocked' : (request?.status ?? 'none'),
    favorite: Boolean(fav),
    favoriteAlerts: fav?.alerts ?? true,
    trips: upcoming.map((t) => ({ city: t.city, arriveOn: t.arrive_on, nights: t.nights,
      arrivalTime: t.arrival_time ? String(t.arrival_time).slice(0, 5) : null,
      departOn: t.departure_on ?? null,
      departureTime: t.departure_time ? String(t.departure_time).slice(0, 5) : null,
    })),
    conversation,
  });
}

