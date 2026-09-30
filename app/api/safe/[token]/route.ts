import { unstable_noStore as noStore } from 'next/cache';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { deriveState, type MeetRow } from '@/lib/meet/shared';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * What a trusted contact sees from the share link. No sign-in. Deliberately minimal: who, since when,
 * check-in state, where (only the label the member typed). Never boundaries, never the other person.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  noStore(); // nothing here reads cookies/headers, so tell Next explicitly: never cache the Supabase fetches.
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const token = params.token;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: m } = await supabaseAdmin
    .from('meets')
    .select('id, a_id, status, meet_type, checkin_every, place_label, trusted_contact, started_at, ends_at, last_checkin_at, next_checkin_at, alert_at, ended_at, checkins')
    .eq('share_token', token)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: u } = await supabaseAdmin.from('users').select('handle').eq('id', m.a_id).maybeSingle();
  const row = m as unknown as MeetRow;
  return NextResponse.json({
    name: u?.handle ? `@${u.handle}` : 'Your friend',
    contactName: (m.trusted_contact as { name?: string } | null)?.name ?? null,
    state: deriveState(row),
    meetType: m.meet_type,
    placeLabel: m.place_label,
    checkinEvery: m.checkin_every,
    startedAt: m.started_at,
    endsAt: m.ends_at,
    lastCheckinAt: m.last_checkin_at,
    nextCheckinAt: m.next_checkin_at,
    alertAt: m.alert_at,
    endedAt: m.ended_at,
    checkins: m.checkins,
    now: new Date().toISOString(),
  });
}
