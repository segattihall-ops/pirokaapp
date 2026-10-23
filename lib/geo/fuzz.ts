import 'server-only';
import crypto from 'crypto';

/**
 * Location fuzzing for privacy. Server only — clients never receive the true point.
 *
 * The public point is a deterministic offset of the true point. The offset is a pure
 * function of the publication seed (HMAC-SHA256), not of the coordinates, so a new GPS
 * fix does not roll a new sample. Callers keep that seed until the location row is
 * deleted (`stableFuzzSeedHex`). A fresh seed on every read would let someone average
 * the pins back onto the true point.
 *
 * Distance is drawn from the annulus [FUZZ_MIN_METERS, radius], uniform in area:
 *   r = sqrt(u * (Rmax² − Rmin²) + Rmin²)
 * The previous draw was uniform on [0, 800] m, so a share of members were published
 * within a few metres of where they actually were. Snapping to a grid and then adding
 * a disc does not create a hard floor: the cell center can sit on the member, and the
 * offset can point back across them, unless the inner radius exceeds the cell's
 * half-diagonal — which would push pins past the 800 m cap this map already uses.
 * The annulus keeps that cap and guarantees the floor.
 *
 * The floor is 250 m, inside the 200–300 m band. The outer radius stays 800 m.
 */
export const FUZZ_MIN_METERS = 250;
export const FUZZ_MAX_METERS = 800;

const EARTH_RADIUS_M = 6_371_000;

export function fuzzLocation(
  trueLat: number,
  trueLng: number,
  seed: Buffer,
  radiusMeters = FUZZ_MAX_METERS,
): { lat: number; lng: number } {
  const maxMeters = Math.max(radiusMeters, FUZZ_MIN_METERS);
  const minMeters = FUZZ_MIN_METERS;
  const hashBytes = crypto.createHmac('sha256', seed).update('fuzz-annulus-v1').digest();
  const bearing = uint32Unit(hashBytes, 0) * 2 * Math.PI;
  const u = uint32Unit(hashBytes, 4);
  const distance = Math.sqrt(u * (maxMeters * maxMeters - minMeters * minMeters) + minMeters * minMeters);
  return destination(trueLat, trueLng, distance, bearing);
}

/** Four bytes → [0, 1). Zero maps to the inner radius, never inside it. */
function uint32Unit(bytes: Buffer, offset: number): number {
  return bytes.readUInt32BE(offset) / 0x1_0000_0000;
}

function destination(
  latDeg: number,
  lngDeg: number,
  distanceM: number,
  bearing: number,
): { lat: number; lng: number } {
  const delta = distanceM / EARTH_RADIUS_M;
  const lat1 = (latDeg * Math.PI) / 180;
  const lng1 = (lngDeg * Math.PI) / 180;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);
  const sinLat2 = sinLat1 * cosDelta + cosLat1 * sinDelta * Math.cos(bearing);
  const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * sinDelta * cosLat1, cosDelta - sinLat1 * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: wrapLng((lng2 * 180) / Math.PI) };
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Intent rings — visual indicator of user availability
 * Shown as concentric circles around user pins on map
 */
export const INTENT_RINGS: Record<string, { label: string; color: string; radiusMi: number }> = {
  now: { label: 'Now', color: '#FF00FF', radiusMi: 0.5 },
  next: { label: 'Next', color: '#00FFFF', radiusMi: 1 },
  hosting: { label: 'Hosting', color: '#00FF00', radiusMi: 1.5 },
  travel: { label: 'Travel', color: '#FFFF00', radiusMi: 2 },
  tonight: { label: 'Tonight', color: '#FF8800', radiusMi: 2.5 },
  later: { label: 'Later', color: '#0088FF', radiusMi: 3 },
  visiting: { label: 'Visiting', color: '#FF0088', radiusMi: 3.5 },
  looking: { label: 'Looking', color: '#88FF00', radiusMi: 4 },
};
