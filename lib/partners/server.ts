import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db/client';
import { isAdmin } from '@/lib/auth/admin';
import { isMissingSchema, schemaPendingResponse } from '@/lib/db/schema-errors';
import type { Session } from '@/lib/auth/types';
import { CLINIC_TAGS, DAYS, VENUE_TAGS, type Hours, type Listing, type ListingKind } from './shared';

export const MIGRATION = '039_partners';

/** `place:<uuid>` or `testing_site:<id>` — the composite key the partner APIs use in URLs. */
export function parseListingKey(key: string): { kind: ListingKind; id: string } | null {
  const i = key.indexOf(':');
  if (i < 0) return null;
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  if ((kind !== 'place' && kind !== 'testing_site') || !id || id.length > 64) return null;
  return { kind, id };
}
export const listingKey = (kind: ListingKind, id: string) => `${kind}:${id}`;

const HoursDay = z.object({
  open: z.boolean(),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
});
export const HoursSchema = z.array(HoursDay).length(7);

export function defaultHours(kind: ListingKind): Hours {
  const clinic = kind === 'testing_site';
  return DAYS.map((_, i) => ({
    open: clinic ? i < 5 : i > 1,
    from: clinic ? '10:00' : '18:00',
    to: clinic ? '18:00' : '02:00',
  }));
}

function normalizeHours(raw: unknown, kind: ListingKind): Hours {
  const parsed = HoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultHours(kind);
}

type Row = {
  listing_kind: ListingKind;
  id: string;
  name: string;
  type: string;
  address: string | null;
  verified: boolean;
  lat: number;
  lon: number;
  hours: unknown;
  tags: string[] | null;
  role?: string;
};

function toListing(r: Row): Listing {
  return {
    key: listingKey(r.listing_kind, r.id),
    kind: r.listing_kind,
    id: r.id,
    name: r.name,
    type: r.type,
    address: r.address ?? '',
    verified: Boolean(r.verified),
    lat: r.lat,
    lon: r.lon,
    hours: normalizeHours(r.hours, r.listing_kind),
    tags: r.tags ?? [],
    tagPool: r.listing_kind === 'testing_site' ? CLINIC_TAGS : VENUE_TAGS,
    role: (r.role as Listing['role']) ?? 'manager',
  };
}

export type ListingsResult = { listings: Listing[]; error?: undefined } | { listings?: undefined; error: NextResponse };

/** Every listing the member manages. */
export async function listingsFor(userId: string): Promise<ListingsResult> {
  const { data, error } = await supabaseAdmin!.rpc('partner_listings_for', { member_id: userId });
  if (error) {
    if (isMissingSchema(error) || /partner_listings_for/.test(error.message ?? ''))
      return { error: NextResponse.json(schemaPendingResponse(MIGRATION), { status: 503 }) };
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  return { listings: ((data ?? []) as Row[]).map(toListing) };
}

/**
 * One listing the session may manage: a member of it, or an admin (who may open any listing).
 * 404 for everything else so listing ids are not enumerable.
 */
export async function requireListing(
  session: Session,
  key: string,
): Promise<{ listing: Listing; error?: undefined } | { listing?: undefined; error: NextResponse }> {
  const parsed = parseListingKey(key);
  if (!parsed) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const mine = await listingsFor(session.userId);
  if (mine.error) return { error: mine.error };
  const found = mine.listings.find((l) => l.kind === parsed.kind && l.id === parsed.id);
  if (found) return { listing: found };
  if (!isAdmin(session)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const { data, error } = await supabaseAdmin!.rpc('partner_listing_one', { p_kind: parsed.kind, p_id: parsed.id });
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  const row = ((data ?? []) as Row[])[0];
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { listing: toListing({ ...row, role: 'owner' }) };
}

async function metric(kind: ListingKind, id: string, metricKind: string, since?: Date) {
  let q = supabaseAdmin!
    .from('partner_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('listing_kind', kind)
    .eq('listing_id', id)
    .eq('kind', metricKind);
  if (since) q = q.gte('at', since.toISOString());
  const { count } = await q;
  return count ?? 0;
}

const pct = (now: number, before: number) => {
  if (!before) return now ? 'new this week' : 'no data yet';
  const d = Math.round(((now - before) / before) * 100);
  return `${d >= 0 ? '+' : ''}${d}% this week`;
};

export type Stat = { label: string; v: string; d: string };

/** The four stat tiles. Totals only — nothing here can identify a member. */
export async function statsFor(l: Listing): Promise<Stat[]> {
  const db = supabaseAdmin!;
  const now = Date.now();
  const week = new Date(now - 7 * 86400_000);
  const twoWeeks = new Date(now - 14 * 86400_000);
  const fmt = (n: number) => n.toLocaleString('en-US');

  const [viewsAll, viewsWeek, viewsPrev] = await Promise.all([
    metric(l.kind, l.id, 'view'),
    metric(l.kind, l.id, 'view', week),
    metric(l.kind, l.id, 'view', twoWeeks),
  ]);
  const views: Stat = { label: 'Profile views', v: fmt(viewsAll), d: pct(viewsWeek, viewsPrev - viewsWeek) };

  if (l.kind === 'testing_site') {
    const [dirAll, dirWeek, dirPrev, calls, callsWeek] = await Promise.all([
      metric(l.kind, l.id, 'directions'),
      metric(l.kind, l.id, 'directions', week),
      metric(l.kind, l.id, 'directions', twoWeeks),
      metric(l.kind, l.id, 'call'),
      metric(l.kind, l.id, 'call', week),
    ]);
    return [
      views,
      { label: 'Direction taps', v: fmt(dirAll), d: pct(dirWeek, dirPrev - dirWeek) },
      { label: 'Calls', v: fmt(calls), d: callsWeek ? `+${callsWeek} this week` : 'none this week' },
      { label: 'Logged tests after visit', v: '—', d: 'health data stays private' },
    ];
  }

  const [{ data: peakRows }, checkinsAll, { count: onTheWay }, { data: evs }] = await Promise.all([
    db.from('partner_metrics').select('at').eq('listing_kind', 'place').eq('listing_id', l.id).eq('kind', 'checkin').order('at', { ascending: false }).limit(500),
    metric('place', l.id, 'checkin'),
    db.from('checkins').select('user_id', { count: 'exact', head: true }).eq('place_id', l.id).eq('kind', 'going').gt('expires_at', new Date().toISOString()),
    db.from('events').select('id').eq('place_id', l.id),
  ]);
  const eventIds = (evs ?? []).map((e) => e.id as string);
  const { count: rsvps } = eventIds.length
    ? await db.from('event_attendees').select('user_id', { count: 'exact', head: true }).in('event_id', eventIds)
    : { count: 0 };

  // Busiest weekday + hour from the anonymous check-in log.
  let peak = 'no check-ins yet';
  if (peakRows?.length) {
    const buckets = new Map<string, number>();
    for (const r of peakRows) {
      const d = new Date(r.at as string);
      const k = `${d.getDay()}-${d.getHours()}`;
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    const [best] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
    const [day, hour] = best.split('-').map(Number);
    const h12 = hour % 12 || 12;
    peak = `peak ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]} ${h12} ${hour < 12 ? 'AM' : 'PM'}`;
  }

  return [
    views,
    { label: 'Check-ins', v: fmt(checkinsAll), d: peak },
    { label: 'On the way now', v: fmt(onTheWay ?? 0), d: 'live' },
    { label: 'Event RSVPs', v: fmt(rsvps ?? 0), d: `${eventIds.length} event${eventIds.length === 1 ? '' : 's'}` },
  ];
}
