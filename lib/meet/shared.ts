/** SafeMeet state shared by the API, the owner's card and the public contact page. Pure functions, no I/O. */

export type MeetStatus = 'active' | 'ended' | 'alert' | 'cancelled';
export type MeetType = 'public' | 'a_place' | 'b_place';

export type MeetRow = {
  id: string;
  status: MeetStatus;
  meet_type: MeetType;
  eta_minutes: number;
  checkin_every: number;
  boundaries: string | null;
  place_label: string | null;
  trusted_contact: { name: string; phone?: string | null } | null;
  started_at: string;
  ends_at: string | null;
  last_checkin_at: string | null;
  next_checkin_at: string | null;
  alert_at: string | null;
  ended_at: string | null;
  checkins: number;
};

/** Grace after a missed check-in before the meet counts as "overdue" (minutes). */
export const GRACE_MIN = 10;
export const CHECKIN_OPTIONS = [15, 30, 45, 60];
export const ETA_OPTIONS = [30, 60, 90, 120, 180, 240];

export type Derived = 'ok' | 'due' | 'overdue' | 'alert' | 'ended' | 'cancelled';

/** What the contact page and the card show, derived from timestamps so no cron is needed to be correct. */
export function deriveState(m: Pick<MeetRow, 'status' | 'next_checkin_at' | 'ends_at'>, now = Date.now()): Derived {
  if (m.status === 'alert') return 'alert';
  if (m.status === 'ended') return 'ended';
  if (m.status === 'cancelled') return 'cancelled';
  const next = m.next_checkin_at ? new Date(m.next_checkin_at).getTime() : null;
  if (next === null) return 'ok';
  if (now > next + GRACE_MIN * 60_000) return 'overdue';
  if (now > next) return 'due';
  return 'ok';
}

export const MEET_TYPE_LABEL: Record<MeetType, string> = {
  public: 'Public place',
  a_place: 'At my place',
  b_place: 'At their place',
};

export function minutesUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - now) / 60_000);
}
