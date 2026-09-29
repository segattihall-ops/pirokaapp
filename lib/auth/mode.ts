import type { AuthMode } from './types';

/**
 * Auth runs on Supabase Auth when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY exist.
 * Without them the app falls back to a signed demo cookie so every screen and the
 * full gate flow can be exercised locally. Demo mode is refused in production builds
 * unless NEXT_PUBLIC_AUTH_DEMO=1 is set on purpose (e.g. a Vercel preview).
 */
export function authMode(): AuthMode {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (configured) return 'supabase';
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_AUTH_DEMO !== '1') {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY or NEXT_PUBLIC_AUTH_DEMO=1.',
    );
  }
  return 'demo';
}

export const isDemo = () => authMode() === 'demo';
