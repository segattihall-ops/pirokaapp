import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { isMissingSchema } from '@/lib/db/schema-errors';

/** User ids with a protective hold. Missing column (migration not applied) yields an empty set. */
export async function heldAmong(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!supabaseAdmin || unique.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('id', unique)
    .not('safety_hold_at', 'is', null);
  if (error) {
    if (!isMissingSchema(error)) console.error('safety hold lookup failed', error.code, error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.id as string));
}

export async function eitherHeld(a: string, b?: string): Promise<boolean> {
  const held = await heldAmong(b ? [a, b] : [a]);
  return held.size > 0;
}

/**
 * Ids that must not appear in search. A protective hold is `safety_hold_at`.
 * Suspended and removed accounts stay out as well. A member who chose visibility hidden
 * is not treated as held.
 */
export async function idsExcludedFromDiscovery(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Set<string>();
  if (!supabaseAdmin || unique.length === 0) return out;
  const full = await supabaseAdmin
    .from('users')
    .select('id, deleted_at, mod_step, safety_hold_at')
    .in('id', unique);
  let rows = full.data as
    | { id: string; deleted_at: string | null; mod_step: string | null; safety_hold_at: string | null }[]
    | null;
  if (full.error && isMissingSchema(full.error)) {
    const again = await supabaseAdmin.from('users').select('id, deleted_at, mod_step').in('id', unique);
    rows = (again.data ?? []).map((row) => ({
      id: row.id as string,
      deleted_at: (row.deleted_at as string | null) ?? null,
      mod_step: (row.mod_step as string | null) ?? null,
      safety_hold_at: null,
    }));
  } else if (full.error) {
    console.error('discovery exclusion lookup failed', full.error.code, full.error.message);
    return out;
  }
  for (const row of rows ?? []) {
    const suspended = row.mod_step === 'suspended' || row.mod_step === 'removed';
    if (row.deleted_at || row.safety_hold_at || suspended) out.add(row.id);
  }
  return out;
}
