import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { opsAlert } from '@/lib/alerts/server';
import { appUrl } from '@/lib/app-url';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';
import { TidaRequestSchema, isNciiPublicReport, tidaDeadline } from '@/lib/legal/tida';
import { PUBLIC_QUEUE_REASON, PUBLIC_REPORT_TYPES, reportAlertText } from '@/lib/safety/reasons';

export const dynamic = 'force-dynamic';

const Body = z.object({
  type: z.enum(PUBLIC_REPORT_TYPES),
  link: z.string().trim().max(500).optional(),
  text: z.string().trim().min(4).max(4000),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  tida: TidaRequestSchema.optional(),
});

/**
 * Public report/removal intake. No account is required.
 *
 * For "Shared without consent", this route enforces the written elements used for a TAKE IT DOWN
 * notice: electronic signature, enough information to locate the depiction, a good-faith
 * non-consent statement, and contact information. The structured request is stored in the report
 * evidence JSON so Trust & Safety can run the statutory 48-hour clock without a schema migration.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`help-report:${ip}`, 5, 3600))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a reason and describe what happened.' }, { status: 400 });
  }

  const { type, link, text, email, tida } = parsed.data;
  const ncii = isNciiPublicReport(type);

  if (ncii) {
    if (!link?.trim()) {
      return NextResponse.json(
        { error: 'Give us a profile, URL, message, or other information that lets us locate the image.' },
        { status: 400 },
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: 'A contact email is required for an intimate-image removal request.' },
        { status: 400 },
      );
    }
    const requestCheck = TidaRequestSchema.safeParse(tida);
    if (!requestCheck.success) {
      return NextResponse.json(
        { error: 'Signature, request capacity, and the good-faith statement are required.' },
        { status: 400 },
      );
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
      { status: 503 },
    );
  }

  const session = await getSession().catch(() => null);
  const storedReason = PUBLIC_QUEUE_REASON[type];
  const urgent = ['Underage', 'CSAM', 'Shared my photos', 'Trafficking', 'Threats or stalking'].includes(
    storedReason,
  );

  const receivedAt = new Date();
  const deadlineAt = ncii ? tidaDeadline(receivedAt).toISOString() : null;

  const evidence: Record<string, unknown> = {
    source: 'public_form',
    public_label: type,
    link: link || null,
    contact_email: email || null,
    urgent,
  };

  if (ncii && tida) {
    evidence.tida = {
      signature: tida.signature,
      capacity: tida.capacity,
      good_faith: true,
      received_at: receivedAt.toISOString(),
      deadline_at: deadlineAt,
      request_version: '47usc223a-v1',
    };
  }

  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_id: session?.userId ?? null,
      reason: storedReason,
      details: text,
      reporter_ip: ip === 'unknown' ? null : ip,
      evidence,
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

  if (session?.userId) {
    await supabaseAdmin
      .from('audit_log')
      .insert({
        actor_id: session.userId,
        action: ncii ? 'report.ncii_removal_filed' : 'report.public_filed',
        target: id,
        details: { type, deadlineAt },
      })
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return NextResponse.json({ id, ...(deadlineAt ? { deadlineAt } : {}) });
}
