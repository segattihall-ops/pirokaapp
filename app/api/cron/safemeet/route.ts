import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { notify } from '@/lib/notify/server';
import { GRACE_MIN } from '@/lib/meet/shared';

export const dynamic = 'force-dynamic';

/**
 * Reminder sweep for SafeMeet. Vercel Cron calls this (vercel.json); it can also be hit by any scheduler with
 * `Authorization: Bearer $CRON_SECRET`. State on the contact page is derived from timestamps, so a late or
 * missing sweep never makes it wrong — this only adds the push nudges.
 *  - check-in due and not yet reminded → push "Time to check in"
 *  - overdue past the grace period → push "You missed your check-in" (once), status stays derived as overdue
 *  - past ends_at by an hour with no check-in → auto-end so stale meets don't linger
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const now = Date.now();
  const { data: rows } = await supabaseAdmin
    .from('meets')
    .select('id, a_id, next_checkin_at, ends_at, reminded_at, last_checkin_at, conversation_id')
    .eq('status', 'active')
    .lte('next_checkin_at', new Date(now).toISOString())
    .limit(500);

  let reminded = 0;
  let overdue = 0;
  let ended = 0;
  for (const m of rows ?? []) {
    const next = new Date(m.next_checkin_at!).getTime();
    const url = m.conversation_id ? `/app/chats/${m.conversation_id}` : '/app/me';
    if (m.ends_at && now > new Date(m.ends_at).getTime() + 60 * 60_000) {
      await supabaseAdmin.from('meets').update({ status: 'ended', ended_at: new Date(now).toISOString() }).eq('id', m.id);
      ended += 1;
      continue;
    }
    if (!m.reminded_at) {
      await supabaseAdmin.from('meets').update({ reminded_at: new Date(now).toISOString() }).eq('id', m.id);
      await notify(m.a_id, { kind: 'safety', title: 'SafeMeet: time to check in', body: 'Tap "I’m OK" so your contact sees you are fine.', url });
      reminded += 1;
    } else if (now > next + GRACE_MIN * 60_000 && new Date(m.reminded_at).getTime() < next + GRACE_MIN * 60_000) {
      await supabaseAdmin.from('meets').update({ reminded_at: new Date(now).toISOString() }).eq('id', m.id);
      await notify(m.a_id, { kind: 'safety', title: 'SafeMeet: check-in missed', body: 'Your contact page now shows you as overdue. Check in or end the meet.', url });
      overdue += 1;
    }
  }
  return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, reminded, overdue, ended });
}
