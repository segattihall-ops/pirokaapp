import assert from 'node:assert/strict';
import crypto from 'crypto';
import { describe, test } from 'node:test';
import { FUZZ_MAX_METERS, FUZZ_MIN_METERS, fuzzLocation } from './fuzz';

const EARTH_RADIUS_M = 6_371_000;

/** Independent of fuzz.ts, so a bug in the offset formula cannot grade itself. */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  // Shortest longitude span, so a pin wrapped across ±180 still measures a few hundred metres.
  const dLng = Math.atan2(Math.sin(toRad(b.lng - a.lng)), Math.cos(toRad(b.lng - a.lng)));
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function initialBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x);
}

const PLACES = [
  { lat: 0, lng: 0 },
  { lat: 37.7749, lng: -122.4194 },
  { lat: -23.5505, lng: -46.6333 },
  { lat: 64.1466, lng: -21.9426 },
  { lat: 89.5, lng: 12 },
  { lat: -89.5, lng: -40 },
  { lat: 40.7, lng: 179.99 },
  { lat: -33.9, lng: -179.99 },
];

describe('fuzzLocation annulus', () => {
  test('the floor stays inside 200–300 m and the cap stays 800 m', () => {
    assert.ok(FUZZ_MIN_METERS >= 200 && FUZZ_MIN_METERS <= 300);
    assert.equal(FUZZ_MIN_METERS, 250);
    assert.equal(FUZZ_MAX_METERS, 800);
  });

  test('displayed distance stays inside the annulus for many seeds and latitudes', () => {
    const seeds = [
      Buffer.alloc(16, 0),
      Buffer.alloc(16, 0xff),
      Buffer.from('00000000000000000000000000000001', 'hex'),
      ...Array.from({ length: 400 }, () => crypto.randomBytes(16)),
    ];
    let closest = Infinity;
    let farthest = 0;
    for (const place of PLACES) {
      for (const seed of seeds) {
        const pub = fuzzLocation(place.lat, place.lng, seed);
        assert.ok(Number.isFinite(pub.lat) && Number.isFinite(pub.lng));
        assert.ok(pub.lat >= -90 && pub.lat <= 90);
        assert.ok(pub.lng >= -180 && pub.lng <= 180);
        const meters = haversineMeters(place, pub);
        closest = Math.min(closest, meters);
        farthest = Math.max(farthest, meters);
        assert.ok(
          meters >= FUZZ_MIN_METERS - 0.05,
          `seed ${seed.toString('hex')} at ${place.lat},${place.lng} was ${meters} m away`,
        );
        assert.ok(meters <= FUZZ_MAX_METERS + 0.05, `offset ${meters} m exceeded the cap`);
      }
    }
    assert.ok(closest >= FUZZ_MIN_METERS - 0.05);
    assert.ok(farthest <= FUZZ_MAX_METERS + 0.05);
    // The draw must actually use the ring, not collapse to a single radius.
    assert.ok(farthest - closest > 100, `annulus collapsed (${closest}–${farthest})`);
  });

  test('the same seed and true point always publish the same point', () => {
    const seed = crypto.randomBytes(16);
    const first = fuzzLocation(51.5074, -0.1278, seed);
    for (let i = 0; i < 25; i++) {
      assert.deepEqual(fuzzLocation(51.5074, -0.1278, seed), first);
    }
  });

  test('a new GPS fix with the same seed does not roll a new offset', () => {
    const seed = crypto.randomBytes(16);
    const origin = { lat: 32.7767, lng: -96.797 };
    const moved = {
      lat: origin.lat + 2 / 111.32,
      lng: origin.lng - 1.4 / (111.32 * Math.cos((origin.lat * Math.PI) / 180)),
    };
    const pubOrigin = fuzzLocation(origin.lat, origin.lng, seed);
    const pubMoved = fuzzLocation(moved.lat, moved.lng, seed);
    const bearingShift = Math.abs(initialBearing(origin, pubOrigin) - initialBearing(moved, pubMoved));
    const wrapped = Math.min(bearingShift, 2 * Math.PI - bearingShift);
    assert.ok(wrapped < 1e-6, `bearing changed by ${wrapped} rad; the offset was re-rolled`);
    const radiusShift = Math.abs(haversineMeters(origin, pubOrigin) - haversineMeters(moved, pubMoved));
    assert.ok(radiusShift < 0.01, `radius changed by ${radiusShift} m`);
    // The public point translates with the member. It does not jump to a new sample.
    const trueStep = haversineMeters(origin, moved);
    const publicStep = haversineMeters(pubOrigin, pubMoved);
    assert.ok(Math.abs(publicStep - trueStep) < 1, `public step ${publicStep} vs true step ${trueStep}`);
  });

  test('two seeds do not publish the same point', () => {
    const place = { lat: 48.8566, lng: 2.3522 };
    const points = new Set(
      Array.from({ length: 30 }, () => {
        const pub = fuzzLocation(place.lat, place.lng, crypto.randomBytes(16));
        return `${pub.lat.toFixed(6)},${pub.lng.toFixed(6)}`;
      }),
    );
    assert.ok(points.size >= 28, `only ${points.size} distinct public points`);
  });
});
