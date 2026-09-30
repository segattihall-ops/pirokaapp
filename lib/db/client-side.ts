'use client';

import { createClient } from '@/lib/supabase/client';

let instance: ReturnType<typeof createClient> | undefined;

/** Browser Supabase client sharing the auth cookie session (RLS applies). Null on the server or unconfigured. */
export function getSupabase() {
  if (typeof window === 'undefined') return null;
  if (instance === undefined) instance = createClient();
  return instance;
}
