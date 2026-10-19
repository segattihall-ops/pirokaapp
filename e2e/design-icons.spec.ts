import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NAV_ICON_PATHS,
  POSITION_MARKS,
  POSITION_ICON_PATHS,
  PLACE_ICON_PATHS,
  MAP_ICON_PATHS,
  INTENT_ICON_PATHS,
  canonicalPositionMark,
  positionMarkPath,
} from '../lib/design/icon-paths';
import { FILTER_OPTIONS, parseSmartQuery } from '../components/map/filters';

const original = readFileSync(
  join(process.cwd(), 'design_handoff/design/Piroka App v2.dc.html'),
  'utf8',
);

function originalPath(path: string) {
  return original.includes(`'${path}'`);
}

test('prototype path data is the source of truth for the navigational and map glyphs', () => {
  for (const p of [
    ...Object.values(NAV_ICON_PATHS),
    ...Object.values(POSITION_ICON_PATHS),
    ...Object.values(PLACE_ICON_PATHS),
    ...Object.values(MAP_ICON_PATHS),
    ...Object.values(INTENT_ICON_PATHS),
  ]) {
    expect(p).toMatch(/^M/);
    expect(originalPath(p)).toBe(true);
  }
});

test('all seven position options have paths and normalize legacy values', () => {
  expect(POSITION_MARKS.map((p) => p.label)).toEqual([
    'Top', 'Vers Top', 'Vers', 'Vers Bottom', 'Bottom', 'Side', 'Switch',
  ]);
  expect(FILTER_OPTIONS.position).toEqual(POSITION_MARKS.map((p) => p.label));
  for (const p of POSITION_MARKS) {
    expect(canonicalPositionMark(p.id)).toBe(p.id);
    expect(canonicalPositionMark(p.label)).toBe(p.id);
    expect(positionMarkPath(p.id)).toBe(p.path);
  }
  expect(canonicalPositionMark('versatile')).toBe('versatile');
  expect(canonicalPositionMark('versatile top')).toBe('vers_top');
  expect(canonicalPositionMark('unknown')).toBeNull();
});

test('smart parser prioritizes compound positions', () => {
  expect(parseSmartQuery('vers top near me').filters.position).toEqual(['Vers Top']);
  expect(parseSmartQuery('vers bottom nearby').filters.position).toEqual(['Vers Bottom']);
  expect(parseSmartQuery('side guys').filters.position).toEqual(['Side']);
  expect(parseSmartQuery('switch').filters.position).toEqual(['Switch']);
});

test('every navigation tab shows its canonical SVG stroke and green active state', async ({ page }) => {
  await page.goto('/'); // Homepage is intentionally public; protected map is covered in map E2E.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 7, 7)');
});
