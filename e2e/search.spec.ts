import { test, expect } from '@playwright/test';

test.describe('Search API', () => {
  test('GET /api/search returns JSON with results', async ({ request }) => {
    const response = await request.get('/api/search?q=test');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBe(true);
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

  test('GET /api/search result objects have required fields', async ({ request }) => {
    const response = await request.get('/api/search?q=hiking');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.results.length > 0) {
      const result = data.results[0];
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('handle');
      expect(result).toHaveProperty('photo');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('relevance');
      expect(result).toHaveProperty('reason');
    }
  });

  test('GET /api/search requires authentication', async ({ request }) => {
    const response = await request.get('/api/search?q=test', {
      headers: { 'Cookie': 'nonexistent=value' },
    });

    // Should return 401 or redirect
    expect([301, 302, 307, 308, 401]).toContain(response.status());
  });
});
