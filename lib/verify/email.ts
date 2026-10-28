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

/**
 * Send a fresh 6-digit code to `email` for this member. The throttle (30s) and per-cycle cap are
 * enforced atomically in the database (email_otp_begin_send, migration 054) so parallel requests
 * can't both pass the check and flood a recipient. An expired cycle resets the cap.
 */
export async function sendEmailCode(userId: string, email: string): Promise<Result> {
  if (!supabaseAdmin) return { ok: false, reason: 'Email verification is not configured' };
  if (!emailConfigured()) return { ok: false, reason: 'Email verification is not configured' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { data, error } = await supabaseAdmin.rpc('email_otp_begin_send', {
    p_user_id: userId,
    p_email: email,
    p_code_hash: hashCode(email, code),
    p_ttl_seconds: Math.round(CODE_TTL_MS / 1000),
    p_max_sends: MAX_SENDS,
    p_resend_min_seconds: Math.round(RESEND_MIN_MS / 1000),
  });
  if (error) return { ok: false, reason: 'Could not start verification' };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    return {
      ok: false,
      reason:
        row?.reason === 'cap'
          ? 'Too many codes requested. Try again in a few minutes.'
          : 'Please wait a moment before requesting another code.',
    };
  }

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

/**
 * Check the code the member entered. The attempt is consumed atomically in the database
 * (email_otp_claim_attempt, migration 054) before the hash is compared, so parallel requests can't
 * exceed the 5-guess cap and brute-force the code. `ok: true` only on an exact, unexpired match.
 */
export async function checkEmailCode(userId: string, email: string, code: string): Promise<Result> {
  if (!supabaseAdmin) return { ok: false, reason: 'Email verification is not configured' };

  const { data, error } = await supabaseAdmin.rpc('email_otp_claim_attempt', {
    p_user_id: userId,
    p_max_attempts: MAX_ATTEMPTS,
  });
  if (error) return { ok: false, reason: 'Could not verify that code.' };
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || row.status === 'none' || (row.email ?? '').toLowerCase() !== email.toLowerCase())
    return { ok: false, reason: 'Request a code first.' };
  if (row.status === 'expired') return { ok: false, reason: 'That code expired. Request a new one.' };
  if (row.status === 'over') return { ok: false, reason: 'Too many attempts. Request a new code.' };

  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(hashCode(email, code), 'hex');
  const match = expected.length === given.length && timingSafeEqual(expected, given);
  if (!match) return { ok: false, reason: 'That code is wrong or expired.' };

  // One-time: consume the code so it can't be replayed.
  await supabaseAdmin.from('email_otps').delete().eq('user_id', userId);
  return { ok: true };
}
