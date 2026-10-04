const FUZZ_SEED_HEX_RE = /^[0-9a-f]{32}$/i;
const HEX_RE = /^[0-9a-f]+$/i;

function decodeHexAscii(hex: string): string | null {
  if (hex.length % 2 || !HEX_RE.test(hex)) return null;
  let value = '';
  for (let i = 0; i < hex.length; i += 2) {
    value += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return value;
}

/**
 * Normalize Postgres bytea representations to the 16-byte seed's 32 hex characters.
 *
 * Supported forms:
 * - 32 raw hex chars (legacy/direct)
 * - \x + 32 hex chars (correct 16-byte bytea)
 * - \x + 64 hex chars whose decoded ASCII is 32 hex chars
 *   (legacy rows written as the ASCII hex string into bytea)
 */
export function normalizeStoredFuzzSeedHex(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  const raw = stored.startsWith('\\x') ? stored.slice(2) : stored;
  if (FUZZ_SEED_HEX_RE.test(raw)) return raw.toLowerCase();

  if (raw.length === 64 && HEX_RE.test(raw)) {
    const decoded = decodeHexAscii(raw);
    if (decoded && FUZZ_SEED_HEX_RE.test(decoded)) return decoded.toLowerCase();
  }
  return null;
}

/**
 * Preserve a publication's fuzz seed across automatic recaptures.
 * A new seed is accepted only when no valid publication seed exists (for example, after DELETE).
 */
export function stableFuzzSeedHex(stored: unknown, generated: string): string {
  const normalized = normalizeStoredFuzzSeedHex(stored);
  if (normalized) return normalized;
  if (!FUZZ_SEED_HEX_RE.test(generated)) throw new Error('Invalid generated fuzz seed');
  return generated.toLowerCase();
}
