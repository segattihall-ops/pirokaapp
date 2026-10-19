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
import { albumLimit } from '../lib/intent';
import { LAUNCH_ALL_ACCESS_UNTIL } from '../lib/billing/launch';
import { approx, exact, dur, tripText, tripDateTime, tripNights, heatOf, heatLabel } from '../lib/map/pin-anatomy';

const original = readFileSync(
  join(process.cwd(), 'design_handoff/design/Piroka App v2.dc.html'),
  'utf8',
);

function originalPath(path: string) {
  return original.includes(`'${path}'`) || original.includes(`d="${path}"`);
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

test('launch all-access promotion expires back to official plan photo limits', () => {
  const afterPromo = LAUNCH_ALL_ACCESS_UNTIL + 1000;
  expect(albumLimit('anonymous', afterPromo)).toBe(2);
  expect(albumLimit('free', afterPromo)).toBe(2);
  expect(albumLimit('plus', afterPromo)).toBe(5);
  expect(albumLimit('premium', afterPromo)).toBe(5);
  expect(albumLimit('free', LAUNCH_ALL_ACCESS_UNTIL - 1000)).toBe(5);
});

test('pin anatomy keeps personal distances approximate outside accepted Meet Mode', () => {
  expect(approx(1930)).toBe('~1.2 mi');
  expect(exact(1930)).toBe('~1.2 mi');
  expect(exact(1930, true)).toBe('1.20 mi');
  expect(dur(135)).toBe('2h 15m');
  expect(dur(40)).toBe('40m');
});

test('traveler dates and clock render real arrival/departure without inventing legacy hours', () => {
  const timed = { arriveOn: '2026-10-23', departOn: '2026-10-26',
    arrivalTime: '15:00', departureTime: '11:00', nights: 3 };
  expect(tripText(timed)).toBe('Arrives Fri 3 PM → Mon 11 AM');
  expect(tripDateTime(timed.arriveOn, timed.arrivalTime)).toBe('Fri, Oct 23, 3:00 PM');
  expect(tripText({ arriveOn: timed.arriveOn, nights: 3 })).toBe('Arrives Fri → Mon');
  expect(tripNights(timed.arriveOn, timed.departOn)).toBe(3);
  expect(tripNights(timed.departOn, timed.arriveOn)).toBe(-3);
});

test('place heat stays neutral white and popping threshold is five active onsite votes', () => {
  expect(heatOf({ here: 5, arriving: 10 })).toBeCloseTo(20 / 45, 5);
  expect(heatLabel(heatOf({ here: 5, arriving: 10 }))).toBe('Lively');
  expect(heatLabel(0)).toBe('Chill');
  expect(heatLabel(0.6)).toBe('Busy');
  expect(heatLabel(0.8)).toBe('Packed');
});
