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

async function verifyPersona(inquiryId: string, method: AgeMethod): Promise<AgeResult> {
  // Phase 1 stub. Production: GET /api/v1/inquiries/{id} with PERSONA_API_KEY and accept when
  // status == 'approved' and the age-over-18 verification passed. Never store the birthdate.
  void inquiryId;
  void method;
  return { ok: false, reason: 'Persona verification not wired yet (BUILD_PLAN Phase 1)' };
}
