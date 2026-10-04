'use client';

export type Position = { lat: number; lon: number; precise: boolean };

const FALLBACK: Position = { lat: 32.7767, lon: -96.797, precise: false }; // launch market: Dallas
const CACHE_KEY = 'piroka_pos';

function cached(): Position | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Position & { at: number };
    return Date.now() - p.at < 10 * 60_000 ? p : null;
  } catch {
    return null;
  }
}

function remember(p: Position) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {}
}

function browserFix(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, precise: true }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  });
}

async function ipFix(): Promise<Position | null> {
  for (const url of ['https://ipapi.co/json/', 'https://get.geojs.io/v1/ip/geo.json']) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = (await r.json()) as { latitude?: string | number; longitude?: string | number };
      const lat = Number(d.latitude);
      const lon = Number(d.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && lat) return { lat, lon, precise: false };
    } catch {}
  }
  return null;
}

/**
 * Best available position: browser geolocation (asks permission), else IP lookup, else launch market.
 * `precise` tells the caller whether it is worth publishing to the server.
 */
export async function getPosition(opts: { ask?: boolean } = {}): Promise<Position> {
  const c = cached();
  if (c && (c.precise || !opts.ask)) return c;
  let granted = false;
  try {
    if (navigator.permissions)
      granted = (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted';
  } catch {}
  if (granted || opts.ask) {
    try {
      const p = await browserFix();
      remember(p);
      return p;
    } catch {}
  }
  const ip = await ipFix();
  const p = ip ?? FALLBACK;
  remember(p);
  return p;
}

export function distanceLabel(m: number): string {
  if (m < 100) return 'right here';
  if (m < 1000) return `${Math.round(m / 50) * 50} m`;
  const mi = m / 1609.34;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export const INTENTS: { value: string; label: string; color: string; hint: string }[] = [
  // Design: green = people available now (now / hosting), white = tonight / later / visiting, grey = just looking.
  { value: 'now', label: 'Available now', color: '#34d399', hint: 'Free right now' },
  { value: 'hosting', label: 'Hosting', color: '#34d399', hint: 'Can host' },
  { value: 'tonight', label: 'Tonight', color: '#f5f5f5', hint: 'Later today' },
  { value: 'later', label: 'Later', color: '#f5f5f5', hint: 'This week' },
  { value: 'visiting', label: 'Visiting', color: '#f5f5f5', hint: 'In town for a bit' },
  { value: 'looking', label: 'Just looking', color: '#666666', hint: 'Open to chat' },
];

export const intentMeta = (v: string | null | undefined) => INTENTS.find((i) => i.value === v) ?? null;

export function timeLeft(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ending';
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m}m left` : `${Math.round(m / 60)}h left`;
}
