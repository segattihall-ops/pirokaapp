import 'server-only';
import { verifyDidit } from './didit';

/**
 * Age verification providers. Only a boolean ever reaches storage.
 *
 * - didit: hosted session (selfie age estimation, ID fallback); see ./didit.ts.
 * - persona: the server creates an inquiry for the signed-in user, the browser completes it in
 *   Persona's embedded flow, and the server asks Persona whether it was approved.
 * - yoti: not wired yet (fails closed).
 * - local: the prototype's on-device UI. It proves nothing about age, so it only runs outside
 *   production, and never when NODE_ENV is production (including Vercel previews).
 */
export type AgeProvider = 'didit' | 'persona' | 'yoti' | 'local';
export type AgeMethod = 'face' | 'id';

export function ageProvider(): AgeProvider {
  const p = process.env.AGE_PROVIDER as AgeProvider | undefined;
  if (p === 'didit' || p === 'persona' || p === 'yoti' || p === 'local') return p;
  if (process.env.DIDIT_API_KEY) return 'didit';
  if (process.env.PERSONA_API_KEY) return 'persona';
  if (process.env.YOTI_CLIENT_SDK_ID && process.env.YOTI_PEM_PATH) return 'yoti';
  return 'local';
}

export type AgeResult = { ok: true; method: AgeMethod } | { ok: false; reason: string };

const PERSONA_API = 'https://api.withpersona.com/api/v1/inquiries';

export async function verifyAgeToken(method: AgeMethod, token: string, userId: string): Promise<AgeResult> {
  const provider = ageProvider();
  switch (provider) {
    case 'didit':
      return verifyDidit(token, userId);
    case 'persona':
      return verifyPersona(token, method, userId);
    case 'yoti':
      return verifyYoti(token, method);
    case 'local':
      if (process.env.NODE_ENV === 'production') {
        return { ok: false, reason: 'No age-verification provider configured' };
      }
      // Token format from the client: "local:<method>:<timestamp>". Anything else is rejected.
      return /^local:(face|id):\d+$/.test(token)
        ? { ok: true, method }
        : { ok: false, reason: 'Invalid token' };
  }
}

/**
 * Creates a Persona inquiry for this user from our template. The user id goes in as the
 * account reference, so the inquiry can later be tied back to this user. Returns the inquiry id.
 */
export async function createPersonaInquiry(
  userId: string,
): Promise<{ ok: true; inquiryId: string } | { ok: false; reason: string }> {
  const apiKey = process.env.PERSONA_API_KEY;
  const templateId = process.env.PERSONA_TEMPLATE_ID;
  if (!apiKey || !templateId) return { ok: false, reason: 'Persona is not configured' };

  const res = await fetch(PERSONA_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      data: { attributes: { inquiry_template_id: templateId } },
      meta: { 'auto-create-account-reference-id': userId },
    }),
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, reason: 'Could not start the age check' };

  const inquiryId = (await res.json())?.data?.id;
  return typeof inquiryId === 'string'
    ? { ok: true, inquiryId }
    : { ok: false, reason: 'Could not start the age check' };
}

/**
 * Asks Persona for the inquiry's status. Accepts only an approved inquiry that was created from
 * our template and belongs to this user, so an inquiry from another user can't be replayed here.
 * Nothing from Persona's response is stored except the pass/fail.
 */
async function verifyPersona(inquiryId: string, method: AgeMethod, userId: string): Promise<AgeResult> {
  const apiKey = process.env.PERSONA_API_KEY;
  const templateId = process.env.PERSONA_TEMPLATE_ID;
  if (!apiKey || !templateId) return { ok: false, reason: 'Persona is not configured' };
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(inquiryId)) return { ok: false, reason: 'Invalid token' };

  const res = await fetch(`${PERSONA_API}/${encodeURIComponent(inquiryId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, reason: 'Could not confirm the age check' };

  const attributes = (await res.json())?.data?.attributes;
  if (attributes?.inquiry_template_id !== templateId)
    return { ok: false, reason: 'Age check does not match this app' };
  if (attributes?.reference_id !== userId)
    return { ok: false, reason: 'Age check belongs to another account' };
  if (attributes?.status !== 'approved') return { ok: false, reason: 'Age check not approved' };
  return { ok: true, method };
}

async function verifyYoti(sessionId: string, method: AgeMethod): Promise<AgeResult> {
  // Not wired. Fails closed until the Yoti integration is built and tested.
  void sessionId;
  void method;
  return { ok: false, reason: 'Yoti verification not wired yet' };
}
