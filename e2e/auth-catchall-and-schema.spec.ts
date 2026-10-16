import { expect, test } from '@playwright/test';
import { isMissingSchema } from '../lib/db/schema-errors';
import { upsertStatusWithTravelFallback, type StatusUpsertRow, type UpsertError } from '../lib/status/upsert';

/**
 * Two production findings from 2026-10-16:
 *  - unknown /api/auth/* paths fell into a next-auth catch-all with no secret: 500 NO_SECRET on
 *    /api/auth/providers and a 30 s hang on /api/auth/session. They are plain 404 JSON now.
 *  - routes that touch schema from an unapplied migration must say so (503 schema_pending), not 500.
 */
test.describe('/api/auth catch-all', () => {
  for (const path of ['/api/auth/session', '/api/auth/providers', '/api/auth/csrf', '/api/auth/signin']) {
    test(`GET ${path} is a fast JSON 404`, async ({ request }) => {
      const started = Date.now();
      const r = await request.get(path);
      expect(Date.now() - started).toBeLessThan(10_000);
      expect(r.status()).toBe(404);
      expect(r.headers()['content-type']).toContain('application/json');
      expect(await r.json()).toEqual({ error: 'Not found' });
    });
  }

  test('POST /api/auth/callback/credentials is a JSON 404', async ({ request }) => {
    const r = await request.post('/api/auth/callback/credentials', { data: { a: 1 } });
    expect(r.status()).toBe(404);
    expect(r.headers()['content-type']).toContain('application/json');
  });

  test('real auth routes are untouched', async ({ request }) => {
    const me = await request.get('/api/auth/me');
    expect([200, 500]).toContain(me.status()); // 500 only without Supabase env
    expect(me.headers()['content-type']).toContain('application/json');
  });
});

test.describe('isMissingSchema', () => {
  test('recognises the PostgREST and Postgres "schema is behind the code" codes', () => {
    expect(isMissingSchema({ code: 'PGRST204', message: "Could not find the 'travel_mi' column" })).toBe(
      true,
    );
    expect(
      isMissingSchema({ code: 'PGRST205', message: "Could not find the table 'public.travel_mode'" }),
    ).toBe(true);
    expect(isMissingSchema({ code: '42703', message: 'column "travel_mi" does not exist' })).toBe(true);
    expect(isMissingSchema({ code: '42P01', message: 'relation "desperate_alerts" does not exist' })).toBe(
      true,
    );
    expect(
      isMissingSchema({ code: '22P02', message: 'invalid input value for enum intent_t: "couchless"' }),
    ).toBe(true);
  });

  test('leaves every other failure alone', () => {
    expect(isMissingSchema(null)).toBe(false);
    expect(isMissingSchema(undefined)).toBe(false);
    expect(isMissingSchema({ code: '22P02', message: 'invalid input syntax for type uuid: "x"' })).toBe(
      false,
    );
    expect(isMissingSchema({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isMissingSchema({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingSchema({ message: 'fetch failed' })).toBe(false);
  });
});

/**
 * Codex P2 on PR 24: with migration 035 applied, switching an existing "travel" status to another
 * intent must clear `travel_mi`, otherwise the next GET reports a stale radius ("Hosting · 5 mi").
 * Before 035 the column does not exist, so the write falls back to a row without it.
 */
test.describe('upsertStatusWithTravelFallback', () => {
  const base = (over: Partial<StatusUpsertRow>): StatusUpsertRow => ({
    user_id: 'u1',
    intent: 'hosting',
    starts_at: '2026-10-16T00:00:00.000Z',
    ends_at: '2026-10-16T02:00:00.000Z',
    warned: false,
    travel_mi: null,
    ...over,
  });
  const MISSING_COLUMN: UpsertError = { code: 'PGRST204', message: "Could not find the 'travel_mi' column" };
  const MISSING_ENUM: UpsertError = {
    code: '22P02',
    message: 'invalid input value for enum intent_t: "couchless"',
  };

  function recorder(answers: UpsertError[]) {
    const rows: Record<string, unknown>[] = [];
    const upsert = async (row: Record<string, unknown>) => {
      rows.push(row);
      return { error: answers[rows.length - 1] ?? null };
    };
    return { rows, upsert };
  }

  test('035 applied: a non-travel intent sends travel_mi: null so the old radius is cleared', async () => {
    const { rows, upsert } = recorder([null]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'hosting' }));
    expect(r).toEqual({ error: null, legacy: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('travel_mi', null);
  });

  test('035 applied: the travel intent sends its radius', async () => {
    const { rows, upsert } = recorder([null]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'travel', travel_mi: 8 }));
    expect(r).toEqual({ error: null, legacy: false });
    expect(rows[0]).toHaveProperty('travel_mi', 8);
  });

  test('035 missing: a non-travel intent is retried without travel_mi and succeeds', async () => {
    const { rows, upsert } = recorder([MISSING_COLUMN, null]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'now' }));
    expect(r).toEqual({ error: null, legacy: true });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty('travel_mi', null);
    expect(rows[1]).not.toHaveProperty('travel_mi');
    expect(rows[1]).toMatchObject({ user_id: 'u1', intent: 'now', warned: false });
  });

  test('035 missing: the travel intent is not retried, the schema error surfaces (503 schema_pending)', async () => {
    const { rows, upsert } = recorder([MISSING_COLUMN, null]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'travel', travel_mi: 5 }));
    expect(r).toEqual({ error: MISSING_COLUMN, legacy: false });
    expect(isMissingSchema(r.error)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  test('035 missing: "couchless" fails the retry on the enum and the schema error surfaces', async () => {
    const { rows, upsert } = recorder([MISSING_COLUMN, MISSING_ENUM]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'couchless' }));
    expect(r).toEqual({ error: MISSING_ENUM, legacy: true });
    expect(isMissingSchema(r.error)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  test('a non-schema failure is returned as is, without a retry', async () => {
    const denied: UpsertError = { code: '42501', message: 'permission denied' };
    const { rows, upsert } = recorder([denied, null]);
    const r = await upsertStatusWithTravelFallback(upsert, base({ intent: 'hosting' }));
    expect(r).toEqual({ error: denied, legacy: false });
    expect(rows).toHaveLength(1);
  });
});
