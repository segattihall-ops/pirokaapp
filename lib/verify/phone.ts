import 'server-only';

// Phone trust badge via Twilio Verify (SMS OTP). Like the other providers, this reads env directly and
// degrades to "not configured" (the route answers 503) when the Twilio keys are absent, so the app
// builds and runs without them. We never store the code; on success we store only the phone + a flag.
const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE = process.env.TWILIO_VERIFY_SERVICE_SID;

export const phoneVerifyConfigured = () => Boolean(SID && TOKEN && SERVICE);

async function twilio(path: string, params: Record<string, string>): Promise<Response> {
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64');
  return fetch(`https://verify.twilio.com/v2/Services/${SERVICE}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
}

type Result = { ok: true } | { ok: false; reason: string };

/** Send an SMS code to the number. */
export async function sendPhoneCode(phone: string): Promise<Result> {
  if (!phoneVerifyConfigured()) return { ok: false, reason: 'Phone verification is not configured' };
  try {
    const r = await twilio('Verifications', { To: phone, Channel: 'sms' });
    if (!r.ok) return { ok: false, reason: 'Could not send a code to that number' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not reach the SMS provider' };
  }
}

/** Check the code the member entered. `ok: true` only when Twilio returns status "approved". */
export async function checkPhoneCode(phone: string, code: string): Promise<Result> {
  if (!phoneVerifyConfigured()) return { ok: false, reason: 'Phone verification is not configured' };
  try {
    const r = await twilio('VerificationCheck', { To: phone, Code: code });
    if (!r.ok) return { ok: false, reason: 'Could not check that code' };
    const j = (await r.json().catch(() => ({}))) as { status?: string };
    return j.status === 'approved' ? { ok: true } : { ok: false, reason: 'That code is wrong or expired' };
  } catch {
    return { ok: false, reason: 'Could not reach the SMS provider' };
  }
}
