import { expect, test } from '@playwright/test';
import { isMissingSchema } from '../lib/db/schema-errors';

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
