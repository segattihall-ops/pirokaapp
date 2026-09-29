import 'server-only';
import { cookies } from 'next/headers';
import { createClient as createSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authMode } from './mode';
import { DEMO_COOKIE, demoCookieOptions, signSession, verifySession } from './demo-token';
import type { AuthProvider, Session } from './types';
import { sessionFromUser } from './session-from-user';

/** Current session, or null. Safe to call from Server Components and route handlers. */
export async function getSession(): Promise<Session | null> {
  if (authMode() === 'demo') return verifySession(cookies().get(DEMO_COOKIE)?.value);
  const sb = createSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? sessionFromUser(data.user) : null;
}

/**
 * Persist gate facts. Supabase: app_metadata via the service role (users cannot edit it).
 * Demo: re-sign the cookie.
 */
export async function updateGate(
  session: Session,
  patch: Partial<Pick<Session, 'consentAt' | 'ageVerified' | 'ageMethod'>>,
) {
  const next: Session = { ...session, ...patch };
  if (authMode() === 'demo') {
    cookies().set(DEMO_COOKIE, await signSession(next), demoCookieOptions);
    return next;
  }
  const admin = createAdminClient();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to update gate state.');
  const { error } = await admin.auth.admin.updateUserById(session.userId, {
    app_metadata: {
      ...(patch.consentAt !== undefined ? { consent_at: patch.consentAt } : {}),
      ...(patch.ageVerified !== undefined ? { age_verified: patch.ageVerified } : {}),
      ...(patch.ageMethod !== undefined ? { age_method: patch.ageMethod } : {}),
    },
  });
  if (error) throw error;
  return next;
}

/** Demo-only: create a session for a provider without any real identity check. */
export async function demoSignIn(provider: AuthProvider, email?: string): Promise<Session> {
  if (authMode() !== 'demo') throw new Error('demoSignIn is only available in demo mode');
  const s: Session = {
    userId: `demo_${crypto.randomUUID()}`,
    provider,
    email: email ?? null,
    anonymous: provider === 'anonymous',
    consentAt: null,
    ageVerified: false,
    ageMethod: null,
  };
  cookies().set(DEMO_COOKIE, await signSession(s), demoCookieOptions);
  return s;
}

export async function signOutServer() {
  if (authMode() === 'demo') {
    cookies().set(DEMO_COOKIE, '', { ...demoCookieOptions, maxAge: 0 });
    return;
  }
  await createSupabase()?.auth.signOut();
}
