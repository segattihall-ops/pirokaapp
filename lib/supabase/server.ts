import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv, supabaseConfigured } from '@/lib/env';

/** Server Supabase client (RSC / route handlers). Returns null until env is configured (Phase 2). */
export function createClient() {
  if (!supabaseConfigured) return null;
  const store = cookies();
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; middleware refreshes sessions.
        }
      },
    },
  });
}
