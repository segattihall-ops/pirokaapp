import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/guard';
import { supabaseAdmin } from '@/lib/db/client';
import { checkPhoneCode, phoneVerifyConfigured, sendPhoneCode } from '@/lib/verify/phone';

export const dynamic = 'force-dynamic';

const E164 = /^\+[1-9]\d{6,14}$/;
const SendBody = z.object({ action: z.literal('send'), phone: z.string().regex(E164) });
const CheckBody = z.object({
  action: z.literal('check'),
  phone: z.string().regex(E164),
  code: z.string().regex(/^\d{4,10}$/),
});
const Body = z.union([SendBody, CheckBody]);

/** The signed-in member's phone-verification state. */
export async function GET() {
  const g = await requireUser();
  if (g.error) return g.error;
  if (!supabaseAdmin) return NextResponse.json({ phoneVerified: false, phone: null, configured: false });

  const { data } = await supabaseAdmin
    .from('users')
    .select('phone, phone_verified')
    .eq('id', g.session.userId)
    .maybeSingle();
  return NextResponse.json({
    phoneVerified: Boolean(data?.phone_verified),
    phone: data?.phone ?? null,
    configured: phoneVerifyConfigured(),
  });
}

/** Earn the phone badge: `send` an SMS code, then `check` it. Twilio holds the code; we never store it. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
  if (!phoneVerifyConfigured())
    return NextResponse.json({ error: 'Phone verification is not available yet.' }, { status: 503 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  if (parsed.data.action === 'send') {
    const r = await sendPhoneCode(parsed.data.phone);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 502 });
    return NextResponse.json({ sent: true });
  }

  const r = await checkPhoneCode(parsed.data.phone, parsed.data.code);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 });

  const { error } = await supabaseAdmin
    .from('users')
    .update({ phone: parsed.data.phone, phone_verified: true })
    .eq('id', g.session.userId);
  if (error) return NextResponse.json({ error: 'Could not save your verification' }, { status: 500 });
  return NextResponse.json({ verified: true });
}
