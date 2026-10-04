import type { User } from '@supabase/supabase-js';
import type { AuthProvider, Session } from './types';

/** Map a Supabase user to our Session. Gate facts live in app_metadata (server-writable only). */
export function sessionFromUser(u: User): Session {
  const meta = (u.app_metadata ?? {}) as Record<string, unknown>;
  const providerRaw = String(meta.provider ?? 'email');
  const anonymous = Boolean((u as User & { is_anonymous?: boolean }).is_anonymous);
  const provider: AuthProvider = anonymous ? 'anonymous' : providerRaw === 'google' ? 'google' : 'email';
  return {
    userId: u.id,
    provider,
    email: u.email ?? null,
    anonymous,
    consentAt: typeof meta.consent_at === 'string' ? meta.consent_at : null,
    ageVerified: meta.age_verified === true,
    ageMethod: meta.age_method === 'face' || meta.age_method === 'id' ? meta.age_method : null,
  };
}
