import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { ensureUserRow } from '@/lib/db/users';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { opsAlert } from '@/lib/alerts/server';
import { appUrl } from '@/lib/app-url';
import { clientIp } from '@/lib/api/rate-limit';
import { maybeApplyUnderageHold } from '@/lib/safety/apply-hold';
import { IN_APP_REASONS, reportAlertText } from '@/lib/safety/reasons';

export const dynamic = 'force-dynamic';

const Body = z.object({
  targetId: z.string().uuid(),
  reason: z.enum(IN_APP_REASONS),
  details: z.string().trim().max(2000).optional(),
  conversationId: z.string().uuid().optional(),
});

/** Files a report for the moderation queue. Evidence stays client-side unless the reporter pastes it in `details`. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  const { targetId, reason, details, conversationId } = parsed.data;
  if (targetId === session.userId)
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', session.userId)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Too many reports, try later' }, { status: 429 });

  await ensureUserRow(session);
  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_id: session.userId,
      target_id: targetId,
      reason,
      details: details || null,
      evidence: conversationId ? { conversationId } : null,
      // Moderator-only: helps link repeat/abusive reporters. 'unknown' → null when no header is present.
      reporter_ip: clientIp(request) === 'unknown' ? null : clientIp(request),
      status: 'open',
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from('audit_log').insert({
    actor_id: session.userId,
    action: 'report.filed',
    target: data.id,
    target_user_id: targetId,
    details: { reason },
  });
  void track({ userId: session.userId, event: EVENTS.report_filed, props: { reason } });

  // Underage only. Other reasons are severity + alert; a person decides. Failures here must not
  // drop the report or put the narrative into the alert.
  try {
    await maybeApplyUnderageHold({
      reason,
      reporterId: session.userId,
      reporterAgeVerified: session.ageVerified === true,
      targetId,
      reportId: data.id,
    });
  } catch (err) {
    console.error('underage protective hold failed', err instanceof Error ? err.name : 'error');
  }

  await opsAlert('report', reportAlertText({ reason, reportId: data.id, origin: appUrl() }));
  return NextResponse.json({ id: data.id });
}
