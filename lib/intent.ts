// Intent, availability, pin rings, and Smart Inbox buckets — ported from the prototype logic.

export type Intent = 'now' | 'next' | 'hosting' | 'travel' | 'tonight' | 'later' | 'visiting' | 'looking';
export type Status = { intent: Intent; startsAt: number; endsAt: number }; // ms epoch

export const INTENTS: Record<Intent, { label: string; color: string }> = {
  now: { label: 'Available now', color: '#34d399' },
  next: { label: 'Next hour', color: '#34d399' },
  hosting: { label: 'Hosting', color: '#34d399' },
  travel: { label: 'Can travel', color: '#34d399' },
  tonight: { label: 'Tonight', color: '#f5f5f5' },
  later: { label: 'Later', color: '#f5f5f5' },
  visiting: { label: 'Visiting', color: '#f5f5f5' },
  looking: { label: 'Just looking', color: '#666666' },
};

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
export const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/** Intent chips on the map. */
export function matchesIntentChip(i: Intent, chip: 'all' | 'now' | 'tonight' | 'hosting' | 'visitors') {
  if (chip === 'all') return true;
  if (chip === 'now') return ['now', 'next', 'hosting', 'travel'].includes(i);
  if (chip === 'tonight') return ['tonight', 'later'].includes(i);
  if (chip === 'hosting') return i === 'hosting';
  return i === 'visiting';
}

export type Bucket = 'NOW' | 'MUTUAL' | 'ACTIVE' | 'LATER' | 'EXPIRED';
/** Smart Inbox bucket for a conversation partner. */
export function bucketFor(
  p: { mutual: boolean; status?: Status; arrivingAt?: number },
  now = Date.now(),
): Bucket {
  if (p.mutual) return 'MUTUAL';
  const s = p.status;
  if (s && s.intent !== 'looking' && s.endsAt < now) return 'EXPIRED';
  if (s && ['now', 'next', 'hosting', 'travel'].includes(s.intent) && s.startsAt <= now + 60 * 60e3)
    return 'NOW';
  if ((s && ['tonight', 'later'].includes(s.intent)) || p.arrivingAt) return 'LATER';
  return 'ACTIVE';
}

/** Progressive photo reveal (px blur). Risk regions stay fully blurred until mutual. */
export function photoBlur(o: { mutual: boolean; inMeet: boolean; chatted: boolean; riskRegion: boolean }) {
  if (o.mutual || o.inMeet) return 0;
  return o.chatted && !o.riskRegion ? 5 : 11;
}

/** Album limit by plan. */
export const albumLimit = (plan: 'anonymous' | 'free' | 'plus' | 'premium') =>
  plan === 'plus' || plan === 'premium' ? 5 : 2;
