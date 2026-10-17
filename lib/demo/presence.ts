import type { NearbyPerson } from '@/app/api/nearby/route';
import { LIVE_INTENTS, type Intent } from '@/lib/intent';

/**
 * Client-side simulated presence, ported from the prototype's world() generator. Used only when there is no
 * backend (nearby returns configured:false) or ?demo=1, so the live map is populated instead of empty.
 * Nothing here is persisted or sent anywhere; ids are prefixed "demo:" so the UI can tell them apart.
 */

export type DemoPlace = {
  id: string;
  name: string;
  kind: 'bar' | 'club' | 'sauna' | 'park' | 'cafe' | 'gym';
  lat: number;
  lon: number;
  here: number;
  arriving: number;
  popping: boolean;
  peak: string;
};

export type DemoEvent = { id: string; name: string; lat: number; lon: number; time: string; going: number };
export type DemoArrival = {
  id: string;
  handle: string;
  lat: number;
  lon: number;
  originCode: string | null;
  when: string;
};
export type DemoHotspot = { lat: number; lon: number; count: number; up: boolean };

export type DemoWorld = {
  people: NearbyPerson[];
  places: DemoPlace[];
  events: DemoEvent[];
  arrivals: DemoArrival[];
  hotspots: DemoHotspot[];
};

const HANDLES = [
  'NightOwl',
  'Curious_32',
  'DiscreetDad',
  'GymRat',
  'Otter_co',
  'QuietStorm',
  'BearHug',
  'Vers4Now',
  'Midtown_M',
  'TallGuy',
  'Sk8rBoi',
  'ChillSun',
  'RunnerUp',
  'SilverFox',
  'Plaid',
  'CoffeeFirst',
  'Nomad',
  'Rooftop',
  'LateShift',
  'Harbor',
];
const GENDERS = ['Man', 'Man', 'Man', 'Trans man', 'Woman', 'Trans woman', 'Non-binary'];
const POSITIONS = ['top', 'versatile', 'bottom'];
const COMMUNITIES = ['Bear', 'Cub', 'Otter', 'Jock', 'Twink', 'Daddy', 'Discreet', 'Sober'];
const ETHNICITIES = ['Asian', 'Black', 'Latinx', 'Mixed', 'White', 'Middle Eastern'];
const ORIENT = ['Gay', 'Bisexual', 'Pansexual', 'Queer'];
const FLAGS = ['br', 'mx', 'us-tx', 'us-ny', 'ca', 'gb', 'es', 'pt', 'de', 'ar'];
const INTENT_POOL: Intent[] = [
  'now',
  'now',
  'now',
  'next',
  'hosting',
  'travel',
  'tonight',
  'tonight',
  'later',
  'visiting',
  'looking',
  'couchless',
];
const PLACES: [string, DemoPlace['kind']][] = [
  ['The Eagle', 'bar'],
  ['Club Rain', 'club'],
  ['Midtown Sauna', 'sauna'],
  ['Rooftop 9', 'bar'],
  ['Park Loop', 'park'],
  ['Café Pride', 'cafe'],
  ['Iron District Gym', 'gym'],
  ['Velvet', 'club'],
];
const EVENT_NAMES = [
  'Drag Bingo',
  'Leather Night',
  'Sapphic Social',
  'Bear Happy Hour',
  'Queer Run Club',
  'Latin Night',
];
const PEAKS = ['10 PM', '11 PM', '12 AM', '1 AM'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const some = <T>(a: T[], n: number): T[] =>
  a
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, n);

/** Metres → degrees offset at a given latitude. */
function offset(lat: number, lon: number, metres: number, angle: number): { lat: number; lon: number } {
  const cosL = Math.cos((lat * Math.PI) / 180) || 1;
  return {
    lat: lat + (Math.sin(angle) * metres) / 111_320,
    lon: lon + (Math.cos(angle) * metres) / (111_320 * cosL),
  };
}

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function demoWorld(center: { lat: number; lon: number }): DemoWorld {
  const now = Date.now();
  // Six hubs fanned around the viewer (not piled on the centre), so presence spreads across the map the way
  // the prototype does and the self pin keeps its breathing room rather than being buried under a blob.
  const hubs = Array.from({ length: 6 }, (_, i) =>
    offset(center.lat, center.lon, rnd(600, 2600), (i / 6) * 6.28 + rnd(-0.5, 0.5)),
  );

  const people: NearbyPerson[] = Array.from({ length: 30 }, (_, i): NearbyPerson => {
    const k = pick(INTENT_POOL);
    const useHub = Math.random() < 0.5;
    const base = useHub
      ? pick(hubs)
      : offset(center.lat, center.lon, (0.3 + Math.pow(Math.random(), 0.7)) * 2100, rnd(0, 6.28));
    // Fan hub members out over a wide ring so pins read individually instead of stacking into one circle.
    const pos = useHub ? offset(base.lat, base.lon, rnd(120, 560), rnd(0, 6.28)) : base;
    let startsAt = now;
    let endsAt = now + rnd(15, 170) * 60_000;
    if (k === 'next') {
      startsAt = now + rnd(15, 55) * 60_000;
      endsAt = startsAt + rnd(60, 150) * 60_000;
    } else if (k === 'tonight' || k === 'later') {
      startsAt = now + rnd(90, 320) * 60_000;
      endsAt = startsAt + rnd(120, 240) * 60_000;
    } else if (k !== 'looking') {
      startsAt = now - rnd(5, 70) * 60_000;
    }
    const gender = pick(GENDERS);
    const anon = Math.random() < 0.3;
    return {
      id: `demo:u${i}`,
      handle: anon ? '' : HANDLES[i % HANDLES.length] + (i >= HANDLES.length ? String(i) : ''),
      lat: pos.lat,
      lon: pos.lon,
      distanceM: Math.round(metres(center, pos)),
      intent: k,
      intentStartsAt: k === 'looking' ? null : new Date(startsAt).toISOString(),
      intentEndsAt: k === 'looking' ? null : new Date(endsAt).toISOString(),
      travelMi: k === 'travel' ? pick([1, 3, 5, 10, 15]) : null,
      desperateUntil: Math.random() < 0.08 ? new Date(now + 20 * 60_000).toISOString() : null,
      activity: Math.random() < 0.6 ? 'active' : Math.random() < 0.6 ? 'recent' : 'today',
      photo: null,
      verified: Math.random() < 0.5,
      plan: Math.random() < 0.3 ? 'premium' : 'free',
      attrs: {
        gender: [gender],
        orientation: [
          gender === 'Woman' || gender === 'Trans woman'
            ? pick(['Lesbian', 'Bisexual', 'Queer'])
            : pick(ORIENT),
        ],
        communities: some(COMMUNITIES, (1 + Math.random() * 2) | 0),
        ethnicity: [pick(ETHNICITIES)],
        position: gender === 'Woman' || gender === 'Trans woman' ? [] : [pick(POSITIONS)],
        origin: Math.random() < 0.3 ? pick(FLAGS) : null,
      },
    };
  });

  const places: DemoPlace[] = PLACES.map(([name, kind], i) => {
    const base = i < 4 ? hubs[i] : offset(center.lat, center.lon, rnd(300, 1700), rnd(0, 6.28));
    return {
      id: `demo:p${i}`,
      name,
      kind,
      lat: base.lat,
      lon: base.lon,
      here: Math.round(rnd(3, 38)),
      arriving: Math.round(rnd(0, 10)),
      popping: Math.random() < 0.35,
      peak: pick(PEAKS),
    };
  });

  const events: DemoEvent[] = places.slice(0, 3).map((p, i) => ({
    id: `demo:e${i}`,
    name: EVENT_NAMES[i % EVENT_NAMES.length],
    lat: p.lat + 0.0007,
    lon: p.lon - 0.0007,
    time: pick(['9 PM', '10 PM', '11 PM']),
    going: Math.round(rnd(8, 90)),
  }));

  const arrivals: DemoArrival[] = Array.from({ length: 4 }, (_, i) => {
    const p = offset(center.lat, center.lon, rnd(400, 1800), rnd(0, 6.28));
    const days = Math.round(rnd(1, 5));
    return {
      id: `demo:a${i}`,
      handle: HANDLES[(i * 3 + 1) % HANDLES.length],
      lat: p.lat,
      lon: p.lon,
      originCode: pick(FLAGS),
      when: `Arrives in ${days} day${days === 1 ? '' : 's'}`,
    };
  });

  // Hotspots: ~450 m cells with 3+ live people, matching the real nearby_hotspots contract.
  const liveNow = people.filter((p) => p.intent && LIVE_INTENTS.includes(p.intent));
  const cells = new Map<string, { lat: number; lon: number; n: number }>();
  for (const p of liveNow) {
    const key = `${Math.round(p.lat / 0.004)},${Math.round(p.lon / 0.005)}`;
    const c = cells.get(key) ?? { lat: 0, lon: 0, n: 0 };
    c.lat += p.lat;
    c.lon += p.lon;
    c.n += 1;
    cells.set(key, c);
  }
  const hotspots: DemoHotspot[] = [...cells.values()]
    .filter((c) => c.n >= 3)
    .map((c) => ({ lat: c.lat / c.n, lon: c.lon / c.n, count: c.n, up: Math.random() < 0.6 }));

  return { people, places, events, arrivals, hotspots };
}
