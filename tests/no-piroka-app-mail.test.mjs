// Public contact mail must not name a domain that does not resolve.
// Fails if '@piroka.app' appears in app/, components/, lib/, or legal content.
// Run: node --test tests/no-piroka-app-mail.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROOTS = ['app', 'components', 'lib', 'docs/legal-review'];
const FORBIDDEN = '@piroka.app';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile()) out.push(p);
  }
  return out;
}

function hitsIn(abs) {
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  if (text.includes('\0')) return [];
  const lines = [];
  text.split('\n').forEach((line, i) => {
    if (line.toLowerCase().includes(FORBIDDEN)) lines.push(i + 1);
  });
  return lines;
}

test("no '@piroka.app' in app, components, lib, or legal content", () => {
  const offenders = [];
  for (const root of ROOTS) {
    for (const abs of walk(join(ROOT, root))) {
      const lines = hitsIn(abs);
      if (lines.length) offenders.push(`${relative(ROOT, abs)}:${lines.join(',')}`);
    }
  }
  assert.deepEqual(offenders, [], `${FORBIDDEN} is still published`);
});
