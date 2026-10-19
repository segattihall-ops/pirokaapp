import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Risk-region enforcement (runtime). Admins toggle protected countries in the `risk_regions` table
 * (stored by English country name, e.g. "Saudi Arabia"). At location-publish time we resolve the
 * member's country from the request and, when it is a protected region, flag their location row with
 * `risk_region = true`. The map (nearby) and profile reveal paths already consult that flag via
 * canRevealMainPhoto, so flipping it is what turns admin intent into real area-level photo protection.
 */

const norm = (s: string) => s.trim().toLowerCase();

/** English country name for an ISO alpha-2 code (e.g. "SA" → "Saudi Arabia"), or null. */
export function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/**
 * True when the given ISO alpha-2 country code resolves to a country an admin has marked as a risk
 * region. Never throws: a missing table or lookup error means "not protected" so location publish is
 * never blocked by this check.
 */
export async function isRiskRegion(code: string | null | undefined): Promise<boolean> {
  const name = countryNameFromCode(code);
  if (!name || !supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin.from('risk_regions').select('country').eq('enabled', true);
    if (error || !data) return false;
    const target = norm(name);
    return data.some((r: { country: string }) => norm(r.country) === target);
  } catch {
    return false;
  }
}
