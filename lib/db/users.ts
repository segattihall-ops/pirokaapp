import 'server-only';
import { supabaseAdmin } from './client';
import type { Session } from '@/lib/auth/types';

/** The auth trigger normally creates the row; this covers users created before it existed. */
export async function ensureUserRow(session: Session): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from('users')
    .upsert(
      { id: session.userId, auth_provider: session.provider, email: session.email },
      { onConflict: 'id', ignoreDuplicates: true },
    );
}
