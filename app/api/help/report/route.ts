import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { opsAlert } from '@/lib/alerts/server';
import { appUrl } from '@/lib/app-url';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';
import { PUBLIC_QUEUE_REASON, PUBLIC_REPORT_TYPES, reportAlertText } from '@/lib/safety/reasons';

export const dynamic = 'force-dynamic';

const Body = z.object({
  type: z.enum(PUBLIC_REPORT_TYPES),
  link: z.string().trim().max(300).optional(),
  text: z.string().trim().min(4).max(2000),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
});

/**
 * Public "Report or request removal" intake (design: Piroka_Help → Report content). No account needed.
 * The report is stored in the same `reports` table the Trust & Safety queue reads (target unknown until a
 * moderator identifies it). The ops alert is only a pointer (type, id, admin link). The narrative,
 * contact address and any map link stay in the row. If the row cannot be stored we answer 503.
 */
export async function POST(request: Request) {
  // The form needs no account, so a per-IP limit (shared across instances) is the only brake on abuse.
  const ip = clientIp(request);
  if (!(await rateLimit(`help-report:${ip}`, 5, 3600))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Choose a reason and describe what happened.' }, { status: 400 });
  const { type, link, text, email } = parsed.data;

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
      { status: 503 },
    );
  }

  const session = await getSession().catch(() => null);
  const storedReason = PUBLIC_QUEUE_REASON[type];
  const urgent = storedReason === 'Underage' || storedReason === 'Shared my photos';

  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_id: session?.userId ?? null,
      reason: storedReason,
      details: text,
      reporter_ip: ip === 'unknown' ? null : ip,
      evidence: {
        source: 'public_form',
        public_label: type,
        link: link || null,
        contact_email: email || null,
        urgent,
      },
      status: 'open',
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('public report insert failed', error);
    return NextResponse.json(
      { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
      { status: 503 },
    );
  }
  const id = data.id as string;

  await opsAlert('report', reportAlertText({ reason: storedReason, reportId: id, origin: appUrl() }));

  if (session?.userId && supabaseAdmin) {
    await supabaseAdmin
      .from('audit_log')
      .insert({ actor_id: session.userId, action: 'report.public_filed', target: id, details: { type } })
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return NextResponse.json({ id });
}
