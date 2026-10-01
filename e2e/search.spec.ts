import { test, expect } from '@playwright/test';

test.describe('Search API', () => {
  test('GET /api/search requires authentication', async ({ request }) => {
    const response = await request.get('/api/search?q=test');

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /api/search returns 400 for missing q param', async ({ request }) => {
    const response = await request.get('/api/search');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /api/search returns 400 for empty q param', async ({ request }) => {
    const response = await request.get('/api/search?q=');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/search returns JSON (not HTML)', async ({ request }) => {
    const response = await request.get('/api/search?q=test');

    // Ensure response is JSON, not HTML (the main issue we're fixing)
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);

    // Should be valid JSON (even if it's an error)
    const data = await response.json();
    expect(data).toBeDefined();
  });
});
