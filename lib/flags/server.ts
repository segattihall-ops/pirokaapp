import 'server-only';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Feature flags. Resolution order: env override `FLAG_<KEY>=1|0` → `feature_flags` row (enabled +
 * percentage rollout, sticky per user) → false. DB rows are cached for 30 s per instance.
 */

export type Flag = {
  key: string;
  enabled: boolean;
  rollout_pct: number;
  description: string | null;
  updated_at: string;
};

let cache: { at: number; rows: Flag[] } | null = null;
const TTL = 30_000;

export async function listFlags(fresh = false): Promise<Flag[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.rows;
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from('feature_flags').select('*').order('key');
  cache = { at: Date.now(), rows: (data ?? []) as Flag[] };
  return cache.rows;
}

export function invalidateFlagCache() {
  cache = null;
}

function bucket(key: string, userId: string): number {
  return parseInt(createHash('sha1').update(`${key}:${userId}`).digest('hex').slice(0, 8), 16) % 100;
}

export async function isFlagEnabled(key: string, userId?: string | null): Promise<boolean> {
  const env = process.env[`FLAG_${key.toUpperCase()}`];
  if (env === '1' || env === 'true') return true;
  if (env === '0' || env === 'false') return false;
  const row = (await listFlags()).find((f) => f.key === key);
  if (!row || !row.enabled) return false;
  if (row.rollout_pct >= 100) return true;
  if (!userId) return false;
  return bucket(key, userId) < row.rollout_pct;
}

/** Every flag resolved for one user — what /api/flags returns to the browser. */
export async function flagsFor(userId?: string | null): Promise<Record<string, boolean>> {
  const rows = await listFlags();
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.key] = await isFlagEnabled(r.key, userId);
  return out;
}
