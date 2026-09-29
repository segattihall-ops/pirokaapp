import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Server-side Supabase client (uses service role key, bypasses RLS for admin operations)
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * Get a user by auth provider
 */
export async function getUserByProvider(provider: string, providerId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_provider', provider)
    .eq('id', providerId)
    .single();

  return { data, error };
}

/**
 * Create or update a user from onboarding data
 */
export async function upsertUser(userId: string, profile: any) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        id: userId,
        handle: profile.displayName,
        pronouns: profile.pronouns || [],
        gender: profile.gender || [],
        orientation: profile.orientation || [],
        communities: profile.communities || [],
        show_me: profile.showMe || [],
        safety_prefs: {
          blurPhotos: profile.blurPhotos ?? true,
          verifiedOnly: profile.verifiedOnly ?? false,
          strangerFilter: profile.strangerFilter ?? true,
        },
        age_verified: profile.ageVerified || false,
      },
      { onConflict: 'id' }
    )
    .select();

  return { data, error };
}

/**
 * Save a location (for geolocation step)
 */
export async function saveLocation(
  userId: string,
  trueLat: number,
  trueLng: number,
  fuzzSeed: Buffer,
  publicLat: number,
  publicLng: number,
  countryCode?: string
) {
  const { data, error } = await supabaseAdmin
    .from('locations')
    .upsert(
      {
        user_id: userId,
        true_geo: `POINT(${trueLng} ${trueLat})`,
        public_geo: `POINT(${publicLng} ${publicLat})`,
        fuzz_seed: fuzzSeed.toString('hex'),
        country_code: countryCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select();

  return { data, error };
}

/**
 * Check if onboarding is complete for a user
 */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('handle, gender, orientation, communities, show_me')
    .eq('id', userId)
    .single();

  if (error || !data) return false;

  // Onboarding complete if core fields are filled
  return !!(data.handle && data.gender?.length > 0 && data.orientation?.length > 0);
}
