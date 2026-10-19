import { expect, test } from '@playwright/test';
import { approx, exact, dur, heatOf, heatLabel, dayName, clockAt, tripText, validDay, tripNights, isPopping, isSelfPinVisible } from '../lib/map/pin-anatomy';
import { canRevealMainPhoto } from '../lib/profile/photo-visibility';
import { INTENTS } from '../lib/intent';

test('semantic intent colors match the fixed App v2 system', () => {
  for (const k of ['now', 'next', 'hosting', 'travel'] as const) expect(INTENTS[k].color).toBe('#34d399');
  for (const k of ['tonight', 'later', 'visiting'] as const) expect(INTENTS[k].color).toBe('#f5f5f5');
  expect(INTENTS.looking.color).toBe('#666666');
});

test('public distances never reveal unrounded exact feet or coordinates', () => {
  expect(approx(1931)).toBe('~1.2 mi');
  expect(exact(1931, false)).toBe('~1.2 mi');
  expect(exact(50, true)).toBe('160 ft');
  expect(dur(135)).toBe('2h 15m');
  expect(dur(40)).toBe('40m');
});

test('white-only place heat intensity and labels follow the prototype cutoffs', () => {
  expect(heatOf({ here: 0, arriving: 0 })).toBe(0);
  expect(heatLabel(heatOf({ here: 8, arriving: 1 }))).toBe('Chill');
  expect(heatLabel(heatOf({ here: 15, arriving: 1 }))).toBe('Lively');
  expect(heatLabel(heatOf({ here: 28, arriving: 1 }))).toBe('Busy');
  expect(heatLabel(heatOf({ here: 40, arriving: 1 }))).toBe('Packed');
  expect(heatOf({ here: 100, arriving: 100 })).toBe(1);
});

test('trip clocks preserve declared civil dates and do not invent legacy times', () => {
  expect(validDay('2026-10-31')).toBe(true);
  expect(validDay('2026-02-31')).toBe(false);
  expect(dayName('2026-10-23')).toBe('Fri');
  expect(clockAt('15:00')).toBe('3 PM');
  expect(tripNights('2026-10-23', '2026-10-26')).toBe(3);
  expect(tripText({ arriveOn: '2026-10-23', nights: 3, arrivalTime: '15:00', departOn: '2026-10-26', departureTime: '11:00' })).toBe('Arrives Fri 3 PM → Mon 11 AM');
  expect(tripText({ arriveOn: '2026-10-23', nights: 3 })).toBe('Arrives Fri → Mon');
});

test('five distinct active on-site votes are required for a red flame', () => {
  expect(isPopping(0)).toBe(false);
  expect(isPopping(4)).toBe(false);
  expect(isPopping(5)).toBe(true);
  expect(isPopping(6)).toBe(true);
  expect(isPopping(4.5)).toBe(false);
});

test('Hidden and missing visibility never paint a self pin', () => {
  expect(isSelfPinVisible('hidden')).toBe(false);
  expect(isSelfPinVisible(null)).toBe(false);
  expect(isSelfPinVisible(undefined)).toBe(false);
  expect(isSelfPinVisible('neighborhood')).toBe(true);
  expect(isSelfPinVisible('area')).toBe(true);
});

test('main photo stays server-blurred after chat alone, album grant or unsafe Meet Mode', () => {
  const base = {
    self: false, mutual: false, activeAcceptedMeet: false,
    viewerRisk: false, peerRisk: false,
  };
  expect(canRevealMainPhoto(base)).toBe(false);
  // Conversation and album grants are intentionally NOT an authorization input.
  expect(canRevealMainPhoto({ ...base, mutual: true })).toBe(true);
  expect(canRevealMainPhoto({ ...base, activeAcceptedMeet: true })).toBe(true);
  expect(canRevealMainPhoto({ ...base, activeAcceptedMeet: true, viewerRisk: true })).toBe(false);
  expect(canRevealMainPhoto({ ...base, activeAcceptedMeet: true, peerRisk: true })).toBe(false);
  expect(canRevealMainPhoto({ ...base, mutual: true, viewerRisk: true })).toBe(true);
  expect(canRevealMainPhoto({ ...base, mutual: true, peerRisk: null })).toBe(false);
  expect(canRevealMainPhoto({ ...base, activeAcceptedMeet: true, viewerRisk: null })).toBe(false);
  expect(canRevealMainPhoto({ ...base, self: true, viewerRisk: null, peerRisk: null })).toBe(true);
});
