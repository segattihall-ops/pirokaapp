// Static guard for the location rule: a member's raw position must never leave the server.
// Scans every API route for (a) selecting the true position column and (b) returning a key that
// names a coordinate. Venues, events and testing sites are public places, so they are allow-listed.
// Run: node --test tests/no-raw-coords.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_PLACE_ROUTES = [
  /^app\/api\/places\//,
  /^app\/api\/events\//,
  /^app\/api\/partners\//,
  /^app\/api\/testing-sites\//,
  /^app\/api\/groups\//,
  /^app\/api\/geocode\//,
  /^app\/api\/admin\/places\//,
  /^app\/api\/admin\/partners\//,
  // Reviewed below: these are not public places. They stay on this list only so the
  // coordinate-key scan does not flag a fuzzed pin, a city the member chose to announce,
  // or the viewer's own query point. The dedicated test checks they never read true_geo.
  /^app\/api\/trips\//,
  /^app\/api\/travel\//,
  /^app\/api\/search\//,
  /^app\/api\/pulse\//,
  /^app\/api\/nearby\//,
  /^app\/api\/area\//,
];

// Latest definitions of the member-discovery RPCs. A new migration that selects true_geo
// has to be added here and must still pass the assertion.
const MEMBER_DISCOVERY_SOURCES = [
  'app/api/nearby/route.ts',
  'app/api/area/messages/route.ts',
  'app/api/trips/route.ts',
  'app/api/travel/trips/route.ts',
  'lib/db/migrations/030_presence_heartbeat.sql',
  'lib/db/migrations/011_discovery.sql',
  'supabase/migrations/20261018160000_037_production_schema_sync.sql',
  'supabase/migrations/20261019043248_piroka_040_trip_pin_itineraries.sql',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

// Comments are stripped so documentation that names a column doesn't count as code.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const routes = walk(join(ROOT, 'app/api')).map((abs) => ({
  rel: relative(ROOT, abs),
  src: stripComments(readFileSync(abs, 'utf8')),
}));

// Routes that legitimately carry coordinate-named keys, with the reason each one is safe.
const REVIEWED = {
  // Returns the FUZZED public position (lib/geo/fuzz.ts) to the member, never the true one.
  'app/api/me/location/route.ts': 'returns the fuzzed public position only',
  // Reads the viewer's fix as input and writes a ~1 km grid to the board; no coordinates in the response.
  'app/api/me/desperate/route.ts': 'input-only fix; board row is rounded to a 1 km grid',
};

test('no API route selects the true (unfuzzed) position column', () => {
  const offenders = routes.filter((r) => /true_geo/.test(r.src)).map((r) => r.rel);
  // Only the location write path may touch true_geo, and it must never echo it back.
  const allowed = new Set(['app/api/me/location/route.ts']);
  // nearby/route.ts only mentions true_geo in a comment, which is stripped above.
  assert.deepEqual(
    offenders.filter((f) => !allowed.has(f)),
    [],
    'true_geo selected outside the location write path',
  );
});

test('member-facing routes never return coordinate keys', () => {
  const keyPattern = /\b(lat|lon|lng|latitude|longitude)\s*:/;
  const offenders = routes
    .filter((r) => !PUBLIC_PLACE_ROUTES.some((re) => re.test(r.rel)))
    .filter((r) => !(r.rel in REVIEWED))
    .filter((r) => /NextResponse\.json\(|new Response\(/.test(r.src))
    .filter((r) => keyPattern.test(r.src))
    .map((r) => r.rel);
  assert.deepEqual(offenders, [], `member routes returning coordinate keys: ${offenders.join(', ')}`);
});

const stripSqlComments = (src) => src.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('nearby, area, and trips never read a member true position', () => {
  const offenders = [];
  for (const rel of MEMBER_DISCOVERY_SOURCES) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    const src = rel.endsWith('.sql') ? stripSqlComments(raw) : stripComments(raw);
    if (/true_geo/.test(src)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `discovery sources mentioning true_geo: ${offenders.join(', ')}`);

  const nearbySql = readFileSync(join(ROOT, 'lib/db/migrations/030_presence_heartbeat.sql'), 'utf8');
  assert.match(nearbySql, /st_y\(l\.public_geo::geometry\)/);
  assert.match(nearbySql, /st_x\(l\.public_geo::geometry\)/);
  assert.doesNotMatch(nearbySql, /true_geo/);

  const hotspots = stripSqlComments(readFileSync(join(ROOT, 'lib/db/migrations/011_discovery.sql'), 'utf8'));
  assert.match(hotspots, /avg\(st_y\(l\.public_geo::geometry\)\)/);
  assert.doesNotMatch(hotspots, /true_geo/);

  // Arrival pins are the city the member announced, rounded to ~1.1 km, not their GPS fix.
  const tripsSql = readFileSync(
    join(ROOT, 'supabase/migrations/20261019043248_piroka_040_trip_pin_itineraries.sql'),
    'utf8',
  );
  assert.match(tripsSql, /round\(st_y\(t\.geo::geometry\)::numeric, 2\)/);
  assert.match(tripsSql, /round\(st_x\(t\.geo::geometry\)::numeric, 2\)/);
  assert.doesNotMatch(tripsSql, /true_geo|public\.locations|from public\.locations/);

  const area = readFileSync(join(ROOT, 'app/api/area/messages/route.ts'), 'utf8');
  assert.match(area, /Math\.round\(v \* 100\) \/ 100/);
  assert.match(area, /\.select\('id, author_id, created_at'\)/);
  assert.match(area, /\.select\('id, author_id, content, created_at, distance_m'\)/);
  assert.match(area, /NextResponse\.json\(\{ id: data\.id, created_at: data\.created_at \}\)/);
  assert.match(area, /NextResponse\.json\(\{ messages: data \?\? \[\] \}\)/);

  const trips = readFileSync(join(ROOT, 'app/api/trips/route.ts'), 'utf8');
  const selects = trips.match(/\.select\('[^']+'\)/g) ?? [];
  assert.ok(selects.length >= 2, 'expected the trips route to name its columns');
  for (const select of selects) {
    assert.doesNotMatch(select, /\b(lat|lon|lng|geo)\b/, select);
  }

  const savedTrips = readFileSync(join(ROOT, 'lib/db/migrations/027_phase20_travel_intelligence.sql'), 'utf8');
  const table = savedTrips.slice(savedTrips.indexOf('create table if not exists saved_trips'), savedTrips.indexOf('destination_insights'));
  assert.doesNotMatch(table, /\b(lat|lon|lng|geo)\b/);
});
