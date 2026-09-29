// Location privacy for πroka. Run on the SERVER only — clients never receive true coordinates.
// Goals: (1) others see an approximate area, (2) repeated queries can't average out the noise,
// (3) distance can't be used to trilaterate a person.

export type Visibility = 'neighborhood' | 'area' | 'hidden';
export type LatLon = { lat: number; lon: number };

const RADIUS_M: Record<Visibility, number> = { neighborhood: 480, area: 1600, hidden: 0 };
const EARTH = 6371000;

/** Deterministic PRNG from a per-session seed (rotate the seed when the user starts a new session). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(bytes: Uint8Array): number {
  return bytes.reduce((h, b) => Math.imul(h ^ b, 16777619) >>> 0, 2166136261);
}

/**
 * Snap to a grid cell first (so small real movements don't move the public point),
 * then add a fixed per-session offset uniformly inside a disc of the visibility radius.
 * Same seed + same cell ⇒ same public point, so averaging many reads reveals nothing.
 */
export function fuzz(p: LatLon, vis: Visibility, seed: number, riskRegion = false): LatLon | null {
  if (vis === 'hidden') return null;
  const r = RADIUS_M[riskRegion ? 'area' : vis];
  const cell = r / 2; // grid size in meters
  const dLat = cell / 111320,
    dLon = cell / (111320 * Math.cos((p.lat * Math.PI) / 180));
  const snapped = { lat: Math.round(p.lat / dLat) * dLat, lon: Math.round(p.lon / dLon) * dLon };
  const rnd = mulberry32(seed ^ Math.round(snapped.lat * 1e4) ^ (Math.round(snapped.lon * 1e4) << 1));
  const dist = r * Math.sqrt(rnd()),
    bearing = rnd() * 2 * Math.PI;
  return offset(snapped, dist, bearing);
}

export function offset(p: LatLon, meters: number, bearing: number): LatLon {
  const d = meters / EARTH,
    la = (p.lat * Math.PI) / 180,
    lo = (p.lon * Math.PI) / 180;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(bearing));
  const lo2 =
    lo +
    Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: (la2 * 180) / Math.PI, lon: (lo2 * 180) / Math.PI };
}

export function meters(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180,
    dl = (b.lat - a.lat) * r,
    dn = (b.lon - a.lon) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.sqrt(h));
}

/** Public distance label — computed between PUBLIC points, rounded up to 0.1 mi, floor 0.1. */
export function distanceLabel(aPublic: LatLon, bPublic: LatLon): string {
  const mi = meters(aPublic, bPublic) / 1609.34;
  return '~' + Math.max(0.1, Math.ceil(mi * 10) / 10).toFixed(1) + ' mi';
}

/** Exact distance — only inside an active, mutually accepted Meet Mode. */
export function exactLabel(aTrue: LatLon, bTrue: LatLon): string {
  const m = meters(aTrue, bTrue),
    ft = m * 3.281;
  return ft < 1000 ? Math.round(ft / 10) * 10 + ' ft' : (m / 1609.34).toFixed(2) + ' mi';
}

/** Rate-limit guard: refuse nearby queries from positions that jump > maxKmh (spoofing / trilateration). */
export function plausibleMove(
  prev: LatLon & { t: number },
  next: LatLon & { t: number },
  maxKmh = 900,
): boolean {
  const h = Math.max(1, next.t - prev.t) / 3.6e6;
  return meters(prev, next) / 1000 / h <= maxKmh;
}
