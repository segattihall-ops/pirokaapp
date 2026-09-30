import { z } from 'zod';

/**
 * Public env (safe for the browser). Everything is optional so the app boots with no keys;
 * each integration switches on when its keys appear. See KEYS.md.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CARTO_KEY: z.string().optional(),
  NEXT_PUBLIC_MAP_STYLE: z.enum(['dark_all', 'esri_dark']).default('dark_all'),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID: z.string().optional(),
  NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  NEXT_PUBLIC_CARTO_KEY: process.env.NEXT_PUBLIC_CARTO_KEY || undefined,
  NEXT_PUBLIC_MAP_STYLE: process.env.NEXT_PUBLIC_MAP_STYLE || undefined,
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || undefined,
  NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID || undefined,
  NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
});

export const supabaseConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const paypalButtonsConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
    publicEnv.NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID &&
    publicEnv.NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID,
);

export const pushClientConfigured = Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
