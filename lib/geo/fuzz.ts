import 'server-only';
import crypto from 'crypto';

/**
 * Location fuzzing for privacy
 * Takes true coordinates and a seed, returns fuzzed coordinates
 * Fuzzing is deterministic per seed but changes the location by 0-800m
 * Used to hide exact position while preserving relative distances for "nearby" queries
 */
export function fuzzLocation(
  trueLat: number,
  trueLng: number,
  seed: Buffer,
  radiusMeters = 800
): { lat: number; lng: number } {
  // PRNG using seed
  const hash = crypto.createHmac('sha256', seed).update('position');
  const hashBytes = hash.digest();

  // Extract angle (0-2π) and distance (0-radiusMeters)
  const angleRaw = (hashBytes[0] / 256) * 2 * Math.PI;
  const distanceRaw = (hashBytes[1] / 256) * radiusMeters;

  // Convert to lat/lng offset
  const earthRadiusM = 6371000;
  const latOffset = (distanceRaw * Math.cos(angleRaw)) / earthRadiusM * (180 / Math.PI);
  const lngOffset = (distanceRaw * Math.sin(angleRaw)) / earthRadiusM * (180 / Math.PI) / Math.cos(trueLat * Math.PI / 180);

  return {
    lat: trueLat + latOffset,
    lng: trueLng + lngOffset,
  };
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
