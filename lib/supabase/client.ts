'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv, supabaseConfigured } from '@/lib/env';

/** Browser Supabase client. Returns null until NEXT_PUBLIC_SUPABASE_* are set (Phase 2). */
export function createClient() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
