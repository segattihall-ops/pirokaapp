import 'server-only';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Referrals (FEATURES §9 "Invite friends"). Each member has one stable invite code. A friend who
 * lands with `?ref=CODE` and finishes onboarding is attributed to the referrer once (migration 050
 * makes that one-per-member). The reward — a month of Plus for both — is recorded as owed on the
 * signup row; granting it is deferred while launch all-access gives everyone Plus anyway.
 */

const CODE_RE = /^[A-Z0-9]{6,12}$/;

/** A stable 8-char code derived from the member id (DB uniqueness still has the final say). */
function deriveCode(userId: string): string {
  const hex = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return BigInt(`0x${hex}`).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
}

/** The member's invite code, creating it on first ask. Null only when the DB is unreachable. */
export async function getOrCreateMyCode(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const existing = await supabaseAdmin
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.data?.code) return existing.data.code;

  // Try the derived code, then a couple of salted fallbacks if another member already holds it.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code =
      attempt === 0 ? deriveCode(userId) : deriveCode(`${userId}:${attempt}`).slice(0, 7) + attempt;
    const { error } = await supabaseAdmin
      .from('referral_codes')
      .insert({ user_id: userId, code, reward_credits: 0 });
    if (!error) return code;
    if (error.code !== '23505') return null; // real error
    // 23505 on user_id (row already made concurrently) → read it back
    const again = await supabaseAdmin
      .from('referral_codes')
      .select('code')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (again.data?.code) return again.data.code;
    // otherwise the code collided with another member's — loop and salt
  }
  return null;
}

/** How many friends this member has brought in. */
export async function myReferralCount(userId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count } = await supabaseAdmin
    .from('referral_signups')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', userId);
  return count ?? 0;
}

/**
 * Attribute a freshly-onboarded member to the referrer behind `code`. Safe to call more than once
 * (migration 050 guards the second insert) and never throws — attribution must not block onboarding.
 */
export async function recordReferral(newUserId: string, code: string): Promise<void> {
  try {
    const c = (code ?? '').trim().toUpperCase();
    if (!supabaseAdmin || !CODE_RE.test(c)) return;

    const { data: rc } = await supabaseAdmin
      .from('referral_codes')
      .select('id, user_id, active, expires_at, max_uses, used_count')
      .eq('code', c)
      .maybeSingle();
    if (!rc || rc.active === false) return;
    if (rc.user_id === newUserId) return; // no self-referral
    if (rc.expires_at && Date.parse(rc.expires_at) < Date.now()) return;
    if (rc.max_uses != null && (rc.used_count ?? 0) >= rc.max_uses) return;

    const { error } = await supabaseAdmin.from('referral_signups').insert({
      referrer_id: rc.user_id,
      new_user_id: newUserId,
      referral_code_id: rc.id,
    });
    // Unique violation = already attributed; nothing more to do.
    if (error) return;

    await supabaseAdmin
      .from('referral_codes')
      .update({ used_count: (rc.used_count ?? 0) + 1 })
      .eq('id', rc.id);
  } catch (e) {
    console.error('recordReferral', e);
  }
}
