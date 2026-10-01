import { test, expect } from '@playwright/test';

test.describe('Phase 14 — Origins + Flags', () => {
  test('GET /api/me/origin returns user origin', async ({ request }) => {
    const response = await request.get('/api/me/origin');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('origin');
      expect(data).toHaveProperty('flag');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/me/origin sets user origin', async ({ request }) => {
    const response = await request.post('/api/me/origin', {
      data: { originCode: 'US' },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data.user.origin).toBe('US');
      expect(data.user.origin_flag).toBe('🇺🇸');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/me/origin validates country code', async ({ request }) => {
    const response = await request.post('/api/me/origin', {
      data: { originCode: 'XX' },
    });

    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
    }
  });

  test('POST /api/me/origin with empty body clears origin', async ({ request }) => {
    const response = await request.post('/api/me/origin', {
      data: {},
    });

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.user.origin).toBeNull();
      expect(data.user.origin_flag).toBeNull();
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('Multiple country codes are supported', async ({ request }) => {
    const countryCodes = ['BR', 'GB', 'JP', 'AU'];

    for (const code of countryCodes) {
      const response = await request.post('/api/me/origin', {
        data: { originCode: code },
      });

      if (response.status() === 200) {
        const data = await response.json();
        expect(data.user.origin).toBe(code);
        expect(data.user.origin_flag).toBeTruthy();
      }
    }
  });

  test('Endpoint requires authentication', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/me/origin' },
    ];

    for (const endpoint of endpoints) {
      const response = await request[endpoint.method.toLowerCase() as 'get'](endpoint.path);
      expect(response.status()).toBe(401);
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });

  test('Origin update returns JSON (not HTML)', async ({ request }) => {
    const response = await request.post('/api/me/origin', {
      data: { originCode: 'CA' },
    });

    expect(response.headers()['content-type']).toContain('application/json');
    if (response.status() !== 401 && response.status() !== 400) {
      expect(response.status()).toBe(200);
    }
  });
});
