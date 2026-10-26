import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { checkEmailCode, emailVerifyConfigured, sendEmailCode } from '@/lib/verify/email';

export const dynamic = 'force-dynamic';

const Email = z.string().email().max(200);
const SendBody = z.object({ action: z.literal('send'), email: Email });
const CheckBody = z.object({
  action: z.literal('check'),
  email: Email,
  code: z.string().regex(/^\d{6}$/),
});
const Body = z.union([SendBody, CheckBody]);

/** The signed-in member's email-verification state. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ emailVerified: false, email: null, configured: false });

  const { data } = await supabaseAdmin
    .from('users')
    .select('verified_email, email_verified')
    .eq('id', g.session.userId)
    .maybeSingle();
  return NextResponse.json({
    emailVerified: Boolean(data?.email_verified),
    email: data?.verified_email ?? null,
    configured: emailVerifyConfigured(),
  });
}

/** Earn the email badge: `send` a 6-digit code by email, then `check` it. We never store the code. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!emailVerifyConfigured())
    return NextResponse.json({ error: 'Email verification is not available yet.' }, { status: 503 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  if (parsed.data.action === 'send') {
    const r = await sendEmailCode(g.session.userId, parsed.data.email);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 502 });
    return NextResponse.json({ sent: true });
  }

  const r = await checkEmailCode(g.session.userId, parsed.data.email, parsed.data.code);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 });

  const { error } = await supabaseAdmin
    .from('users')
    .update({ verified_email: parsed.data.email, email_verified: true })
    .eq('id', g.session.userId);
  if (error) return NextResponse.json({ error: 'Could not save your verification' }, { status: 500 });
  return NextResponse.json({ verified: true });
}
