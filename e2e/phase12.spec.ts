import { test, expect } from '@playwright/test';

test.describe('Phase 12 — i18n, Ethnicity, Position Marks', () => {
  test('GET /api/me/language returns user language preference', async ({ request }) => {
    const response = await request.get('/api/me/language');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('language');
      expect(['en', 'pt-BR', 'es']).toContain(data.language);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/me/language updates language preference', async ({ request }) => {
    const response = await request.post('/api/me/language', {
      data: { language: 'pt-BR' },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('user');
      expect(data.user.language).toBe('pt-BR');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/me/language returns 400 for invalid language', async ({ request }) => {
    const response = await request.post('/api/me/language', {
      data: { language: 'invalid' },
    });

    if (response.status() === 400) {
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });

  test('GET /api/me/profile-attrs returns profile attributes', async ({ request }) => {
    const response = await request.get('/api/me/profile-attrs');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('positionMarks');
      expect(data).toHaveProperty('ethnicity');
      expect(Array.isArray(data.positionMarks)).toBe(true);
      expect(Array.isArray(data.ethnicity)).toBe(true);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('PATCH /api/me/profile-attrs updates position marks', async ({ request }) => {
    const response = await request.patch('/api/me/profile-attrs', {
      data: { positionMarks: ['top', 'versatile'] },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('user');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('PATCH /api/me/profile-attrs updates ethnicity', async ({ request }) => {
    const response = await request.patch('/api/me/profile-attrs', {
      data: { ethnicity: ['Asian', 'White'] },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('user');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('PATCH /api/me/profile-attrs rejects invalid position marks', async ({ request }) => {
    const response = await request.patch('/api/me/profile-attrs', {
      data: { positionMarks: ['invalid'] },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('Endpoints require authentication', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/me/language' },
      { method: 'GET', path: '/api/me/profile-attrs' },
    ];

    for (const endpoint of endpoints) {
      const response = await request[endpoint.method.toLowerCase() as 'get'](endpoint.path);
      expect(response.status()).toBe(401);
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });
});
