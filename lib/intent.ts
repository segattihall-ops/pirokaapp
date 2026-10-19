import { INTENT_ICON_PATHS } from '@/lib/design/icon-paths';
import { launchAllAccess } from '@/lib/billing/launch';

// Intent, availability, pin rings, and Smart Inbox buckets — ported from the prototype logic
// (design_handoff/design/Piroka App v2.dc.html). Shared by the server routes and the client.

export type Intent =
  'now' | 'next' | 'hosting' | 'travel' | 'tonight' | 'later' | 'visiting' | 'looking' | 'couchless';
export type Status = { intent: Intent; startsAt: number; endsAt: number }; // ms epoch

/** The order the PIROKA Mode sheet shows them in. */
export const INTENT_ORDER: Intent[] = [
  'now',
  'next',
  'hosting',
  'travel',
  'tonight',
  'later',
  'visiting',
  'looking',
  'couchless',
];

/** Colour system: green = available people, white = later / places, grey = just looking. */
export const INTENTS: Record<Intent, { label: string; color: string; hint: string }> = {
  now: { label: 'Available now', color: '#34d399', hint: 'Free right now' },
  next: { label: 'Next hour', color: '#34d399', hint: 'Free within the hour' },
  hosting: { label: 'Hosting', color: '#34d399', hint: 'Can host at my place' },
  travel: { label: 'Can travel', color: '#34d399', hint: 'Will come to you' },
  tonight: { label: 'Tonight', color: '#f5f5f5', hint: 'Later today' },
  later: { label: 'Later', color: '#f5f5f5', hint: 'This week' },
  visiting: { label: 'Visiting', color: '#f5f5f5', hint: 'In town for a bit' },
  looking: { label: 'Just looking', color: '#666666', hint: 'Open to chat' },
  couchless: { label: 'Couchless', color: '#f5f5f5', hint: "Can't host or travel far" },
};

export const isIntent = (v: unknown): v is Intent => typeof v === 'string' && v in INTENTS;

/** Intents that count as "available right now" (map chip "Now", Smart Inbox "NOW"). */
export const LIVE_INTENTS: Intent[] = ['now', 'next', 'hosting', 'travel', 'couchless'];

/** Time scrubber: is the person available at time T (now + offset)? */
export const availableAt = (s: Status, T: number) =>
  s.intent === 'looking' || (s.startsAt <= T && T < s.endsAt);

/** Degrees of the conic ring around a pin/avatar (8°–360°). */
export function ringDegrees(s: Status, T: number): number {
  if (s.intent === 'looking') return 360;
  const total = Math.max(30 * 60e3, s.endsAt - s.startsAt);
  return Math.max(8, Math.min(360, (360 * (s.endsAt - T)) / total));
}

export const minutesLeft = (s: Status, T = Date.now()) => Math.max(0, Math.round((s.endsAt - T) / 60e3));
export const fmtDur = (m: number) => {
  m = Math.max(0, Math.round(m));
  if (m < 60) return `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
};

export type IntentChip = 'all' | 'now' | 'tonight' | 'hosting' | 'visitors';
export const INTENT_CHIPS: { key: IntentChip; label: string; color: string }[] = [
  { key: 'all', label: 'Everyone', color: '#999999' },
  { key: 'now', label: 'Now', color: '#34d399' },
  { key: 'tonight', label: 'Tonight', color: '#f5f5f5' },
  { key: 'hosting', label: 'Hosting', color: '#34d399' },
  { key: 'visitors', label: 'Visitors', color: '#f5f5f5' },
];

/** Intent chips on the map. */
export function matchesIntentChip(i: Intent | null | undefined, chip: IntentChip) {
  if (chip === 'all') return true;
  if (!i) return false;
  if (chip === 'now') return LIVE_INTENTS.includes(i);
  if (chip === 'tonight') return i === 'tonight' || i === 'later';
  if (chip === 'hosting') return i === 'hosting';
  return i === 'visiting';
}

/** Small glyph drawn on the pin for intents that change how you meet (prototype: house / arrow / plane / no-couch). */
export const INTENT_BADGE_PATH: Partial<Record<Intent, string>> = INTENT_ICON_PATHS;

export type Bucket = 'NOW' | 'MUTUAL' | 'ACTIVE' | 'LATER' | 'EXPIRED';
/** Smart Inbox bucket for a conversation partner. */
export function bucketFor(
  p: { mutual: boolean; status?: Status; arrivingAt?: number },
  now = Date.now(),
): Bucket {
  if (p.mutual) return 'MUTUAL';
  const s = p.status;
  if (s && s.intent !== 'looking' && s.endsAt < now) return 'EXPIRED';
  if (s && LIVE_INTENTS.includes(s.intent) && s.startsAt <= now + 60 * 60e3) return 'NOW';
  if ((s && ['tonight', 'later'].includes(s.intent)) || p.arrivingAt) return 'LATER';
  return 'ACTIVE';
}

/** Progressive photo reveal (px blur). Risk regions stay fully blurred until mutual. */
export function photoBlur(o: { mutual: boolean; inMeet: boolean; chatted: boolean; riskRegion: boolean }) {
  if (o.mutual || o.inMeet) return 0;
  return o.chatted && !o.riskRegion ? 5 : 11;
}

/** Album limit by plan. */
export const albumLimit = (plan: 'anonymous' | 'free' | 'plus' | 'premium', now: number = Date.now()) =>
  launchAllAccess(now) || plan === 'plus' || plan === 'premium' ? 5 : 2;
