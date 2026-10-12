import 'server-only';

/**
 * Age estimation providers. Only a boolean ever reaches storage.
 *
 * - yoti / persona: verify the token their web SDK returns after a session (server-to-server).
 * - local: the prototype's on-device face/ID check UI. It proves nothing about age and exists
 *   only so the flow runs without a vendor contract. It is refused in production unless
 *   AGE_PROVIDER=local is set on purpose.
 */
export type AgeProvider = 'yoti' | 'persona' | 'local';
export type AgeMethod = 'face' | 'id';

export function ageProvider(): AgeProvider {
  const p = process.env.AGE_PROVIDER as AgeProvider | undefined;
  if (p === 'yoti' || p === 'persona' || p === 'local') return p;
  if (process.env.YOTI_CLIENT_SDK_ID && process.env.YOTI_PEM_PATH) return 'yoti';
  if (process.env.PERSONA_API_KEY) return 'persona';
  return 'local';
}

export type AgeResult = { ok: true; method: AgeMethod } | { ok: false; reason: string };

export async function verifyAgeToken(method: AgeMethod, token: string): Promise<AgeResult> {
  const provider = ageProvider();
  switch (provider) {
    case 'yoti':
      return verifyYoti(token, method);
    case 'persona':
      return verifyPersona(token, method);
    case 'local':
      if (process.env.NODE_ENV === 'production' && process.env.AGE_PROVIDER !== 'local') {
        return { ok: false, reason: 'No age-verification provider configured' };
      }
      // Token format from the client: "local:<method>:<timestamp>". Anything else is rejected.
      return /^local:(face|id):\d+$/.test(token)
        ? { ok: true, method }
        : { ok: false, reason: 'Invalid token' };
  }
}

async function verifyYoti(sessionId: string, method: AgeMethod): Promise<AgeResult> {
  // Phase 1 stub. Production: GET /sessions/{id} on the Yoti Age Estimation API, signed with YOTI_PEM,
  // then accept when `age_check.result == 'PASS'` (threshold 18). Never read or store the estimated age.
  void sessionId;
  void method;
  return { ok: false, reason: 'Yoti verification not wired yet (BUILD_PLAN Phase 1)' };
}

/**
 * Asks Persona for the inquiry's status. Accepts only an approved inquiry created from our own
 * template, so an inquiry from another app or template can't be replayed here. The birthdate and
 * documents stay on Persona's side; nothing from the response is stored except the pass/fail.
 */
async function verifyPersona(inquiryId: string, method: AgeMethod): Promise<AgeResult> {
  const apiKey = process.env.PERSONA_API_KEY;
  const templateId = process.env.PERSONA_TEMPLATE_ID;
  if (!apiKey || !templateId) return { ok: false, reason: 'Persona is not configured' };
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(inquiryId)) return { ok: false, reason: 'Invalid token' };

  const res = await fetch(`https://api.withpersona.com/api/v1/inquiries/${encodeURIComponent(inquiryId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, reason: 'Could not confirm the age check' };

  const attributes = (await res.json())?.data?.attributes;
  if (attributes?.inquiry_template_id !== templateId) return { ok: false, reason: 'Age check does not match this app' };
  if (attributes?.status !== 'approved') return { ok: false, reason: 'Age check not approved' };
  return { ok: true, method };
}
