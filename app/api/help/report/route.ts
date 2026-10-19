import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { opsAlert, opsAlertsConfigured } from '@/lib/alerts/server';
import { clientIp, rateLimit, tooMany } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

// Not exported: Next only allows route-handler exports from a route file.
const PUBLIC_REPORT_TYPES = [
  'Someone under 18',
  'Shared without consent',
  'Impersonation',
  'Harassment or threats',
  'Hate or discrimination',
  'Scam or spam',
  'Illegal content',
  'Other',
] as const;

/** Public labels → the Trust & Safety queue's canonical reasons (lib/admin/ts-seed REASONS/SEV). */
const QUEUE_REASON: Record<(typeof PUBLIC_REPORT_TYPES)[number], string> = {
  'Someone under 18': 'Underage',
  'Shared without consent': 'Shared my photos',
  Impersonation: 'Fake or impersonation',
  'Harassment or threats': 'Harassment',
  'Hate or discrimination': 'Hate or discrimination',
  'Scam or spam': 'Scam or spam',
  'Illegal content': 'Illegal content',
  Other: 'Other',
};

const Body = z.object({
  type: z.enum(PUBLIC_REPORT_TYPES),
  link: z.string().trim().max(300).optional(),
  text: z.string().trim().min(4).max(2000),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
});

/**
 * Public "Report or request removal" intake (design: Piroka_Help → Report content). No account needed.
 * The report is stored in the same `reports` table the Trust & Safety queue reads (target unknown until a
 * moderator identifies it), and the ops alert channel is pinged when configured. Only when neither the
 * database nor the alert channel exists do we answer 503 — never pretend a safety report was received.
 */
export async function POST(request: Request) {
  // The form needs no account, so a per-IP limit (shared across instances) is the only brake on abuse.
  const ip = clientIp(request);
  if (!(await rateLimit(`help-report:${ip}`, 5, 3600))) return tooMany();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Choose a reason and describe what happened.' }, { status: 400 });
  const { type, link, text, email } = parsed.data;

  if (!supabaseAdmin && !opsAlertsConfigured()) {
    return NextResponse.json(
      { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
      { status: 503 },
    );
  }

  const session = await getSession().catch(() => null);
  const urgent = type === 'Someone under 18' || type === 'Shared without consent';

  let id = 'TS-' + (40000 + Math.floor(Math.random() * 9999));
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: session?.userId ?? null,
        reason: QUEUE_REASON[type],
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
      if (!opsAlertsConfigured())
        return NextResponse.json(
          { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
          { status: 503 },
        );
    } else {
      id = data.id as string;
    }
  }

  await opsAlert(
    'report',
    `${urgent ? 'URGENT ' : ''}public report ${id} · ${type}${link ? ` · ${link}` : ''}\n${text}${email ? `\nupdates → ${email}` : ''}`,
  );

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
