import { z } from 'zod';

/**
 * Public env (safe for the browser). Everything is optional in Phase 0 so the app boots with no keys;
 * later phases tighten this as each integration lands.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CARTO_KEY: z.string().optional(),
  NEXT_PUBLIC_MAP_STYLE: z.enum(['dark_all', 'esri_dark']).default('dark_all'),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_CARTO_KEY: process.env.NEXT_PUBLIC_CARTO_KEY || undefined,
  NEXT_PUBLIC_MAP_STYLE: process.env.NEXT_PUBLIC_MAP_STYLE || undefined,
});

export const supabaseConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
