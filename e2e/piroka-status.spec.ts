import { expect, test } from '@playwright/test';

/**
 * PIROKA Mode (travel mode) API contract. The route must never leak a bare 500 for a
 * missing session or a malformed body, and every error must be JSON (the map sheet reads it).
 */
test.describe('PIROKA Mode API', () => {
  test('GET /api/piroka/status requires a session and answers JSON', async ({ request }) => {
    const r = await request.get('/api/piroka/status');
    expect([401, 500]).toContain(r.status()); // 500 only when Supabase env is absent (demo mode)
    expect(r.headers()['content-type']).toContain('application/json');
    const body = await r.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/piroka/status rejects an unauthenticated write', async ({ request }) => {
    const r = await request.post('/api/piroka/status', {
      data: { isActive: true, destinationCity: 'Dallas', appearsInDestination: true, revealDate: null },
    });
    expect([401, 500]).toContain(r.status());
    expect(r.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/piroka/status never executes with a malformed body before auth', async ({ request }) => {
    const r = await request.post('/api/piroka/status', { data: 'not json' });
    expect(r.status()).not.toBe(200);
    expect(r.headers()['content-type']).toContain('application/json');
  });
});
