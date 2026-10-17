import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/server';
import { supabaseAdmin } from '@/lib/db/client';
import { opsAlert, opsAlertsConfigured } from '@/lib/alerts/server';

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

const Body = z.object({
  type: z.enum(PUBLIC_REPORT_TYPES),
  link: z.string().trim().max(300).optional(),
  text: z.string().trim().min(4).max(2000),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
});

// Light per-IP throttle (per instance): the form needs no account, so this is the only brake on abuse.
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/**
 * Public "Report or request removal" intake (design: Piroka_Help → Report content). No account needed.
 * Delivery is the ops alert channel the moderation queue already uses; when that isn't configured we say
 * so with a 503 rather than pretend a safety report was received. Signed-in reporters also get an audit row.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (throttled(ip))
    return NextResponse.json({ error: 'Too many reports, try again later' }, { status: 429 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Choose a reason and describe what happened.' }, { status: 400 });
  const { type, link, text, email } = parsed.data;

  if (!opsAlertsConfigured()) {
    return NextResponse.json(
      { error: 'Reporting is temporarily unavailable. Please use Talk to a person.' },
      { status: 503 },
    );
  }

  const id = 'TS-' + (40000 + Math.floor(Math.random() * 9999));
  const urgent = type === 'Someone under 18' || type === 'Shared without consent';
  await opsAlert(
    'report',
    `${urgent ? 'URGENT ' : ''}public report ${id} · ${type}${link ? ` · ${link}` : ''}\n${text}${email ? `\nupdates → ${email}` : ''}`,
  );

  const session = await getSession().catch(() => null);
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
