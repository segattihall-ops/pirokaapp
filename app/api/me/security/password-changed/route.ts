import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { sendEmail } from '@/lib/email';
import { templates } from '@/lib/email/templates';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * The password itself is changed by Supabase Auth in the browser. The app is told afterwards so it can
 * send the "was this you?" security email and record the event. Idempotent and rate-limited.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await rateLimit(`pwchanged:${session.userId}`, 3, 3600))) return tooMany();

  if (supabaseAdmin) {
    await supabaseAdmin
      .from('audit_log')
      .insert({ actor_id: session.userId, action: 'security.password_changed', target: session.userId });
  }
  void track({ userId: session.userId, event: EVENTS.password_changed });
  if (session.email) {
    void sendEmail({
      to: session.email,
      userId: session.userId,
      template: 'passwordChanged',
      ...templates.passwordChanged(),
    });
  }
  return NextResponse.json({ ok: true });
}
