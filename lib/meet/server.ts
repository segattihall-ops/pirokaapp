import 'server-only';
import { deriveState, type MeetRow } from './shared';

export const MEET_COLUMNS =
  'id, a_id, b_id, status, meet_type, eta_minutes, checkin_every, boundaries, place_label, trusted_contact, started_at, ends_at, last_checkin_at, next_checkin_at, alert_at, ended_at, checkins, share_token, conversation_id';

type DbMeet = MeetRow & { a_id: string; b_id: string; share_token: string | null; conversation_id: string | null };

/** The meet as the API returns it to a participant. Trusted contact and share link are the owner's only. */
export function publicMeet(m: unknown, me: string) {
  const row = m as DbMeet;
  const mine = row.a_id === me;
  return {
    id: row.id,
    mine,
    peerId: mine ? row.b_id : row.a_id,
    conversationId: row.conversation_id,
    status: row.status,
    state: deriveState(row),
    meetType: row.meet_type,
    etaMinutes: row.eta_minutes,
    checkinEvery: row.checkin_every,
    boundaries: row.boundaries,
    placeLabel: row.place_label,
    trustedContact: mine ? row.trusted_contact : null,
    shareToken: mine ? row.share_token : null,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    lastCheckinAt: row.last_checkin_at,
    nextCheckinAt: row.next_checkin_at,
    alertAt: row.alert_at,
    endedAt: row.ended_at,
    checkins: row.checkins,
  };
}

export type PublicMeet = ReturnType<typeof publicMeet>;
