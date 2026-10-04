const FUZZ_SEED_HEX_RE = /^[0-9a-f]{32}$/i;

/**
 * Preserve a publication's fuzz seed across automatic recaptures.
 * A new seed is accepted only when no valid publication seed exists (for example, after DELETE).
 */
export function stableFuzzSeedHex(stored: unknown, generated: string): string {
  if (typeof stored === 'string' && FUZZ_SEED_HEX_RE.test(stored)) return stored;
  if (!FUZZ_SEED_HEX_RE.test(generated)) throw new Error('Invalid generated fuzz seed');
  return generated.toLowerCase();
}
