import { test, expect } from '@playwright/test';

test.describe('Health Card API - Fase 11', () => {
  test('GET /api/health returns health card (or null)', async ({ request }) => {
    const response = await request.get('/api/health');

    // Should return 401 without auth or 200 with valid card
    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('card');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/health requires authentication', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        testType: 'hiv',
        testDate: '2026-01-15',
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/health returns JSON (not HTML)', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQ...',
        testType: 'hiv',
        testDate: '2026-01-15',
      },
    });

    // Ensure response is JSON, not HTML
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);
  });

  test('POST /api/health returns 400 for invalid data', async ({ request }) => {
    const response = await request.post('/api/health', {
      data: {
        imageBase64: 'too-short',
        testType: 'invalid',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('GET /api/testing-sites returns sites by location', async ({ request }) => {
    const response = await request.get('/api/testing-sites?zip=75219');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('sites');
    expect(Array.isArray(data.sites)).toBe(true);
  });

  test('GET /api/testing-sites returns JSON with proper structure', async ({ request }) => {
    const response = await request.get('/api/testing-sites?lat=32.7767&lng=-96.797&radius=5');

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.sites.length > 0) {
      const site = data.sites[0];
      expect(site).toHaveProperty('name');
      expect(site).toHaveProperty('address');
      expect(site).toHaveProperty('latitude');
      expect(site).toHaveProperty('longitude');
      expect(site).toHaveProperty('verified');
    }
  });

  test('POST /api/health/share requires authentication', async ({ request }) => {
    const response = await request.post('/api/health/share', {
      data: {
        granteeId: '00000000-0000-0000-0000-000000000000',
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/health/share requires authentication', async ({ request }) => {
    const response = await request.get('/api/health/share');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('DELETE /api/health/share/[id] requires authentication', async ({ request }) => {
    const response = await request.delete('/api/health/share/00000000-0000-0000-0000-000000000000');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('Health endpoints return JSON (not HTML) errors', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/health/share' },
      { method: 'GET', path: '/api/testing-sites' },
    ];

    for (const endpoint of endpoints) {
      const response = await request[endpoint.method.toLowerCase() as 'get' | 'post'](endpoint.path);

      // All should be JSON responses
      expect(response.headers()['content-type']).toContain('application/json');
      expect(response.status()).not.toBe(500);
    }
  });
});
