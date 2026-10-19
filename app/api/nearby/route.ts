import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { photoUrls } from '@/lib/upload/storage';
import { presenceActivity } from '@/lib/geo/presence';
import { isIntent, type Intent } from '@/lib/intent';
import { isMissingSchema } from '@/lib/db/schema-errors';
import { addTripDays } from '@/lib/map/pin-anatomy';
import { canRevealMainPhoto } from '@/lib/profile/photo-visibility';

export const dynamic = 'force-dynamic';

/** Self-described, public profile facts used by the Filter sheet and the pin badges. Never health or exact location. */
export type NearbyAttrs = {
  gender: string[];
  orientation: string[];
  communities: string[];
  ethnicity: string[];
  /** Position marks as the profile stores them (e.g. "top", "versatile", "bottom"). */
  position: string[];
  /** ISO 3166-1 alpha-2 or `us-xx`, when the member shared where they are from. */
  origin: string | null;
};

export type NearbyPerson = {
  id: string;
  handle: string;
  lat: number;
  lon: number;
  distanceM: number;
  intent: Intent | null;
  intentStartsAt: string | null;
  intentEndsAt: string | null;
  /** "Can travel" radius in miles, only while that intent is live. */
  travelMi: number | null;
  /** Premium "Desperate" alert — a red blinking ring until this time. */
  desperateUntil: string | null;
  activity: 'active' | 'recent' | 'today';
  photo: string | null;
  verified: boolean;
  plan: string;
  attrs: NearbyAttrs;
  /** Viewer-specific relationship. No other member's relationship history is exposed. */
  relationship?: 'stranger' | 'chatted' | 'mutual' | 'meet';
  /** The server signed the original main image only for an authorized mutual/Meet. */
  photoRevealed?: boolean;
  /** Premium-only score from stored, unexpired match_scores; never fabricated. */
  matchScore?: number | null;
  /** Optional public self-described attributes; absent until supported by profile storage. */
  age?: number | null;
  body?: string | null;
  responseMinutes?: number | null;
};

const EMPTY_ATTRS: NearbyAttrs = {
  gender: [],
  orientation: [],
  communities: [],
  ethnicity: [],
  position: [],
  origin: null,
};

/**
 * People with a fresh (24h) privacy-fuzzed position within `radius` metres of the given point.
 * The API never reads or returns locations.true_geo.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ configured: false, people: [], hotspots: [], visitors: [] });

  const q = new URL(request.url).searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  const radius = Math.min(Math.max(Number(q.get('radius') ?? 5000), 500), 50000);
  const intent = q.get('intent');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  const [{ data: rows, error }, { data: spots }, tripResult] = await Promise.all([
    supabaseAdmin.rpc('nearby_users', {
      user_lat: lat,
      user_lon: lon,
      radius_m: Math.round(radius),
      requester_id: session.userId,
      limit_count: 200,
    }),
    supabaseAdmin.rpc('nearby_hotspots', { center_lat: lat, center_lon: lon, radius_m: 25000 }),
    supabaseAdmin.rpc('trips_near_v2', {
      center_lat: lat,
      center_lon: lon,
      radius_m: 50000,
      requester_id: session.userId,
    }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tripRows = tripResult.error ? [] : (tripResult.data ?? []);

  // nearby_users intentionally exposes only public_geo. Everything else about a person is fetched by id
  // from tables that hold no location at all, so widening the pins never widens the location RPC.
  const ids: string[] = (rows ?? []).map((r: any) => r.id).filter(Boolean);
  const nowIso = new Date().toISOString();
  let activeStatuses: any[] = [];
  let profiles: any[] = [];
  let desperate: any[] = [];
  if (ids.length > 0) {
    const [stFirst, pr, dp] = await Promise.all([
      supabaseAdmin
        .from('statuses')
        .select('user_id, starts_at, ends_at, travel_mi')
        .in('user_id', ids)
        .gt('ends_at', nowIso),
      supabaseAdmin
        .from('users')
        .select('id, gender, orientation, communities, ethnicity, position_marks, origin')
        .in('id', ids),
      supabaseAdmin.from('desperate_alerts').select('user_id, until').in('user_id', ids).gt('until', nowIso),
    ]);
    type StatusRow = { user_id: string; starts_at: string; ends_at: string; travel_mi?: number | null };
    let st: { data: StatusRow[] | null; error: { code?: string; message: string } | null } = stFirst;
    // Before migration 035 `statuses.travel_mi` does not exist. Losing every status timer on the map
    // because of one optional column is not acceptable: fall back to the pre-035 shape.
    if (st.error && isMissingSchema(st.error)) {
      st = await supabaseAdmin
        .from('statuses')
        .select('user_id, starts_at, ends_at')
        .in('user_id', ids)
        .gt('ends_at', nowIso);
    }
    if (st.error) console.error('nearby: statuses lookup failed', st.error.code, st.error.message);
    if (pr.error) console.error('nearby: profiles lookup failed', pr.error.code, pr.error.message);
    // `desperate_alerts` also arrives with 035; without it there are simply no alerts to show.
    if (dp.error && !isMissingSchema(dp.error))
      console.error('nearby: desperate lookup failed', dp.error.code, dp.error.message);
    activeStatuses = st.data ?? [];
    profiles = pr.data ?? [];
    desperate = dp.data ?? [];
  }
  const statusOf = new Map(activeStatuses.map((s) => [s.user_id, s]));
  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  const desperateOf = new Map(desperate.map((d) => [d.user_id, d.until as string]));

  // Only use relationships involving this requester. The result never reveals who anyone else chatted with.
  // Do not infer chat/mutual from verification, online state or Premium subscriptions.
  const relationshipOf = new Map<string, 'chatted' | 'mutual' | 'meet'>();
  const scoreOf = new Map<string, number>();
  const clearPhotoKeyOf = new Map<string, string>();
  const safeToReveal = new Set<string>();
  if (ids.length > 0) {
    const [{ data: conversations, error: conversationsError }, { data: meets, error: meetsError }, viewerPlan] = await Promise.all([
      supabaseAdmin.from('conversations').select('a_id, b_id, mutual')
        .or(`a_id.eq.${session.userId},b_id.eq.${session.userId}`),
      supabaseAdmin.from('meets').select('a_id, b_id, accepted_at, ends_at')
        .or(`a_id.eq.${session.userId},b_id.eq.${session.userId}`)
        .not('accepted_at', 'is', null).gt('ends_at', nowIso).eq('status', 'active'),
      supabaseAdmin.from('users').select('plan').eq('id', session.userId).maybeSingle(),
    ]);
    const visibleIds = new Set(ids);
    if (conversationsError && !isMissingSchema(conversationsError))
      console.error('nearby: relationship lookup failed', conversationsError.message);
    for (const c of conversations ?? []) {
      const peer = c.a_id === session.userId ? c.b_id : c.b_id === session.userId ? c.a_id : null;
      if (peer && visibleIds.has(peer)) relationshipOf.set(peer, c.mutual ? 'mutual' : 'chatted');
    }
    if (meetsError && !isMissingSchema(meetsError))
      console.error('nearby: accepted Meet Mode lookup failed', meetsError.message);
    for (const m of meets ?? []) {
      const peer = m.a_id === session.userId ? m.b_id : m.b_id === session.userId ? m.a_id : null;
      if (peer && visibleIds.has(peer) && relationshipOf.get(peer) !== 'mutual') relationshipOf.set(peer, 'meet');
    }
    if (viewerPlan.data?.plan === 'premium') {
      const { data: scores, error: scoreError } = await supabaseAdmin.from('match_scores')
        .select('target_id, score').eq('user_id', session.userId)
        .in('target_id', ids).gt('expires_at', nowIso);
      if (scoreError && !isMissingSchema(scoreError))
        console.error('nearby: match score lookup failed', scoreError.message);
      for (const item of scores ?? []) {
        const score = Number(item.score);
        if (Number.isFinite(score) && score >= 0 && score <= 1) scoreOf.set(item.target_id, score);
      }
    }
    // Only sign the original source if a mutual match exists, or an accepted and active Meet
    // in a region confirmed safe for both people. Missing location safety rows fail closed.
    const candidates = [...relationshipOf].filter(([, rel]) => rel === 'mutual' || rel === 'meet').map(([id]) => id);
    if (candidates.length) {
      const [{ data: photoRows, error: photoError }, { data: riskRows, error: riskError }] = await Promise.all([
        supabaseAdmin.from('photos').select('user_id, storage_key').in('user_id', candidates).eq('slot', 0),
        supabaseAdmin.from('locations').select('user_id, risk_region')
          .in('user_id', [session.userId, ...candidates]),
      ]);
      if (photoError && !isMissingSchema(photoError)) console.error('nearby: clear photo lookup failed', photoError.message);
      if (riskError && !isMissingSchema(riskError)) console.error('nearby: safety lookup failed', riskError.message);
      // No location risk record => do not sign a clear source image, even for a mutual match.
      if (!photoError && !riskError) {
        const riskOf = new Map((riskRows ?? []).map((row) => [row.user_id, Boolean(row.risk_region)]));
        for (const p of photoRows ?? []) {
          const relation = relationshipOf.get(p.user_id);
          if (p.storage_key && canRevealMainPhoto({
            self: false,
            mutual: relation === 'mutual',
            activeAcceptedMeet: relation === 'meet',
            viewerRisk: riskOf.get(session.userId) ?? null,
            peerRisk: riskOf.get(p.user_id) ?? null,
          })) {
            clearPhotoKeyOf.set(p.user_id, p.storage_key);
            safeToReveal.add(p.user_id);
          }
        }
      }
    }
  }

  const photoOf = await photoUrls([
    ...(rows ?? []).map((r: any) => r.photo_blur_key),
    ...(tripRows ?? []).map((t: any) => t.photo_blur_key),
    ...clearPhotoKeyOf.values(),
  ]);
  const people: NearbyPerson[] = (rows ?? [])
    .filter((r: any) => !intent || r.intent === intent)
    .map((r: any) => {
      const status = statusOf.get(r.id);
      const p = profileOf.get(r.id);
      const live: Intent | null = isIntent(r.intent) ? r.intent : null;
      const clearKey = safeToReveal.has(r.id) ? clearPhotoKeyOf.get(r.id) : null;
      const clearPhoto = clearKey ? (photoOf.get(clearKey) ?? null) : null;
      return {
        id: r.id,
        handle: r.handle,
        lat: r.lat,
        lon: r.lon,
        distanceM: Math.round(r.distance_m),
        intent: live,
        intentStartsAt: status?.starts_at ?? null,
        intentEndsAt: status?.ends_at ?? r.intent_ends_at ?? null,
        travelMi: live === 'travel' ? (status?.travel_mi ?? null) : null,
        desperateUntil: desperateOf.get(r.id) ?? null,
        activity: presenceActivity(r.presence_at),
        photo: clearPhoto ?? photoOf.get(r.photo_blur_key) ?? null,
        photoRevealed: Boolean(clearPhoto),
        relationship: relationshipOf.get(r.id) ?? 'stranger',
        matchScore: scoreOf.get(r.id) ?? null,
        verified: Boolean(r.verified),
        plan: r.plan,
        attrs: p
          ? {
              gender: p.gender ?? [],
              orientation: p.orientation ?? [],
              communities: p.communities ?? [],
              ethnicity: p.ethnicity ?? [],
              position: p.position_marks ?? [],
              origin: p.origin ?? null,
            }
          : EMPTY_ATTRS,
      };
    });

  const hotspots = (spots ?? []).map((s: any) => ({
    lat: s.lat,
    lon: s.lon,
    count: Number(s.count),
  }));
  const visitors: Visitor[] = (tripRows ?? []).map((t: any) => ({
    id: t.user_id,
    handle: t.handle ?? null,
    city: t.city,
    arriveOn: t.arrive_on,
    nights: t.nights,
    arrivalTime: t.arrival_time ? String(t.arrival_time).slice(0, 5) : null,
    departOn: t.departure_on ?? addTripDays(t.arrive_on, t.nights),
    departureTime: t.departure_time ? String(t.departure_time).slice(0, 5) : null,
    originCode: t.origin_code ?? null,
    photo: photoOf.get(t.photo_blur_key) ?? null,
    lat: Number.isFinite(t.lat) ? t.lat : null,
    lon: Number.isFinite(t.lon) ? t.lon : null,
  }));
  return NextResponse.json({ configured: true, people, hotspots, visitors });
}

export type Visitor = {
  id: string;
  handle: string | null;
  city: string;
  arriveOn: string;
  nights: number;
  arrivalTime?: string | null;
  departOn?: string | null;
  departureTime?: string | null;
  originCode?: string | null;
  photo: string | null;
  /** The announced city point, so the map can place an arrival pin (null on older DBs without the column). */
  lat: number | null;
  lon: number | null;
};
