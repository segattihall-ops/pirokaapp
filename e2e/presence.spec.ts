import { expect, test } from '@playwright/test';
import { stableFuzzSeedHex } from '../lib/geo/fuzz-session';
import {
  ACTIVE_PRESENCE_MS,
  LOCATION_REFRESH_MS,
  PRESENCE_HEARTBEAT_MS,
  RECENT_PRESENCE_MS,
  presenceActivity,
} from '../lib/geo/presence';

test.describe('map presence timing', () => {
  test('automatic recaptures preserve the existing fuzz publication seed', () => {
    const existing = '11'.repeat(16);
    const generated = '22'.repeat(16);

    expect(stableFuzzSeedHex(existing, generated)).toBe(existing);
    expect(stableFuzzSeedHex(`\\x${existing}`, generated)).toBe(existing);

    const legacyAsciiBytea = Array.from(existing)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    expect(stableFuzzSeedHex(`\\x${legacyAsciiBytea}`, generated)).toBe(existing);

    expect(stableFuzzSeedHex(undefined, generated)).toBe(generated);
    expect(stableFuzzSeedHex('not-a-seed', generated)).toBe(generated);
  });

  test('a long-lived visible session remains active with bounded coordinate age', () => {
    expect(PRESENCE_HEARTBEAT_MS).toBeLessThan(ACTIVE_PRESENCE_MS);
    expect(LOCATION_REFRESH_MS).toBeLessThan(ACTIVE_PRESENCE_MS);

    const openedAt = Date.UTC(2026, 9, 4, 12, 0, 0);
    let presenceAt = openedAt;
    let coordinateCapturedAt = openedAt;

    // Simulate three hours without waiting in real time. Presence is refreshed every 5 minutes
    // and coordinates are recaptured every 10 minutes; neither operation changes public precision.
    for (let elapsed = 0; elapsed <= 3 * 60 * 60_000; elapsed += 60_000) {
      const now = openedAt + elapsed;
      if (elapsed > 0 && elapsed % PRESENCE_HEARTBEAT_MS === 0) presenceAt = now;
      if (elapsed > 0 && elapsed % LOCATION_REFRESH_MS === 0) coordinateCapturedAt = now;

      expect(presenceActivity(new Date(presenceAt).toISOString(), now)).toBe('active');
      expect(now - coordinateCapturedAt).toBeLessThan(ACTIVE_PRESENCE_MS);
    }
  });

  test('presence naturally ages when heartbeats stop', () => {
    const seenAt = Date.UTC(2026, 9, 4, 12, 0, 0);
    const iso = new Date(seenAt).toISOString();

    expect(presenceActivity(iso, seenAt + ACTIVE_PRESENCE_MS)).toBe('active');
    expect(presenceActivity(iso, seenAt + ACTIVE_PRESENCE_MS + 1)).toBe('recent');
    expect(presenceActivity(iso, seenAt + RECENT_PRESENCE_MS)).toBe('recent');
    expect(presenceActivity(iso, seenAt + RECENT_PRESENCE_MS + 1)).toBe('today');
  });
});
