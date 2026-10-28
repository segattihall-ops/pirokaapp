import 'server-only';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/db/client';
import { emailConfigured, sendEmail } from '@/lib/email';
import { layout } from '@/lib/email/templates';

// Email trust badge via an OTP we run ourselves: generate a 6-digit code, send it with the app's
// mailer, and check it against a hashed copy in email_otps. Replaces the Twilio phone badge — no
// third-party provider. Degrades to "not configured" (the route answers 503) only when the app has
// no real mailer (console/demo mode), so it never shows a dead control in production.

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5; // wrong-code guesses before a new code is required
const MAX_SENDS = 6; // codes per pending verification, to bound abuse
const RESEND_MIN_MS = 30 * 1000; // throttle between sends

export const emailVerifyConfigured = () => emailConfigured();

/** Hash the code with the target address so a row is useless for any other email. */
function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex');
}

type Result = { ok: true } | { ok: false; reason: string };

/** Send a fresh 6-digit code to `email` for this member. Throttled and capped per pending row. */
export async function sendEmailCode(userId: string, email: string): Promise<Result> {
  if (!supabaseAdmin) return { ok: false, reason: 'Email verification is not configured' };
  if (!emailConfigured()) return { ok: false, reason: 'Email verification is not configured' };

  const now = Date.now();
  const { data: existing } = await supabaseAdmin
    .from('email_otps')
    .select('sent_count, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    if ((existing.sent_count ?? 0) >= MAX_SENDS)
      return { ok: false, reason: 'Too many codes requested. Try again later.' };
    if (now - Date.parse(existing.updated_at) < RESEND_MIN_MS)
      return { ok: false, reason: 'Please wait a moment before requesting another code.' };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { error } = await supabaseAdmin.from('email_otps').upsert(
    {
      user_id: userId,
      email,
      code_hash: hashCode(email, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      attempts: 0,
      sent_count: (existing?.sent_count ?? 0) + 1,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, reason: 'Could not start verification' };

  const res = await sendEmail({
    to: email,
    template: 'email_verify',
    userId,
    subject: `${code} is your πroka verification code`,
    html: layout({
      title: 'Verify your email',
      bodyHtml: `<p style="margin:0 0 10px">Enter this code in πroka to verify your email. It expires in 10 minutes.</p>
<p style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.3em">${code}</p>
<p style="margin:16px 0 0;color:#888">If you didn't ask to verify an email, you can ignore this.</p>`,
    }),
    text: `Your πroka verification code is ${code}. It expires in 10 minutes. If you didn't ask to verify an email, ignore this.`,
  });
  if (!res.ok) return { ok: false, reason: 'Could not send the code' };
  return { ok: true };
}

/** Check the code the member entered. `ok: true` only on an exact, unexpired, under-limit match. */
export async function checkEmailCode(userId: string, email: string, code: string): Promise<Result> {
  if (!supabaseAdmin) return { ok: false, reason: 'Email verification is not configured' };

  const { data: row } = await supabaseAdmin
    .from('email_otps')
    .select('email, code_hash, expires_at, attempts')
    .eq('user_id', userId)
    .maybeSingle();
  if (!row || row.email.toLowerCase() !== email.toLowerCase())
    return { ok: false, reason: 'Request a code first.' };
  if (Date.parse(row.expires_at) < Date.now())
    return { ok: false, reason: 'That code expired. Request a new one.' };
  if ((row.attempts ?? 0) >= MAX_ATTEMPTS)
    return { ok: false, reason: 'Too many attempts. Request a new code.' };

  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(hashCode(email, code), 'hex');
  const match = expected.length === given.length && timingSafeEqual(expected, given);
  if (!match) {
    await supabaseAdmin
      .from('email_otps')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('user_id', userId);
    return { ok: false, reason: 'That code is wrong or expired.' };
  }

  // One-time: consume the code so it can't be replayed.
  await supabaseAdmin.from('email_otps').delete().eq('user_id', userId);
  return { ok: true };
}
