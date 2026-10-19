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
  /^app\/api\/trips\//,
  /^app\/api\/travel\//,
  /^app\/api\/search\//,
  /^app\/api\/pulse\//,
  /^app\/api\/nearby\//,
  /^app\/api\/area\//,
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
