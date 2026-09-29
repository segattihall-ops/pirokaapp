import 'server-only';
import { verifyYotiToken } from './auth/yoti';

type AgeMethod = 'face' | 'id';

type VerifyResult =
  | { ok: true; method: AgeMethod; ageVerified: boolean }
  | { ok: false; reason: string };

/**
 * Main age verification dispatcher.
 * Routes to the configured provider (Yoti, Persona, or local demo).
 */
export async function verifyAgeToken(method: AgeMethod, token: string): Promise<VerifyResult> {
  const provider = process.env.AGE_PROVIDER || 'local';

  // Local/demo mode: always return verified
  if (provider === 'local') {
    return { ok: true, method, ageVerified: true };
  }

  // Yoti provider
  if (provider === 'yoti') {
    try {
      const result = await verifyYotiToken(token);
      return { ok: true, method, ageVerified: result.ageVerified };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Age verification failed',
      };
    }
  }

  // Persona provider (stub for now)
  if (provider === 'persona') {
    return {
      ok: false,
      reason: 'Persona provider not yet implemented. Use local or yoti.',
    };
  }

  return {
    ok: false,
    reason: `Unknown age provider: ${provider}`,
  };
}
