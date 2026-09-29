import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client. Server only. Used for app_metadata writes (gate state) and moderation. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
