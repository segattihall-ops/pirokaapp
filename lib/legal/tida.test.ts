import assert from 'node:assert/strict';
import test from 'node:test';
import { NCII_PUBLIC_LABEL, TidaRequestSchema, isNciiPublicReport, tidaDeadline } from './tida';

test('recognizes the public NCII report category', () => {
  assert.equal(isNciiPublicReport(NCII_PUBLIC_LABEL), true);
  assert.equal(isNciiPublicReport('Other'), false);
});

test('requires the written TAKE IT DOWN request fields', () => {
  assert.equal(
    TidaRequestSchema.safeParse({
      signature: 'Jane Doe',
      capacity: 'self',
      goodFaith: true,
    }).success,
    true,
  );

  assert.equal(
    TidaRequestSchema.safeParse({
      signature: '',
      capacity: 'self',
      goodFaith: true,
    }).success,
    false,
  );

  assert.equal(
    TidaRequestSchema.safeParse({
      signature: 'Jane Doe',
      capacity: 'authorized',
      goodFaith: false,
    }).success,
    false,
  );
});

test('sets a 48-hour removal deadline', () => {
  const start = new Date('2026-10-24T12:00:00.000Z');
  assert.equal(tidaDeadline(start).toISOString(), '2026-10-26T12:00:00.000Z');
});
