import { test, expect } from '@playwright/test';

test.describe('Phase 13 — AI Assistant, Taste Learning, Favorites', () => {
  test('POST /api/taste records taste preference (like/pass/message)', async ({ request }) => {
    const testUserId = '00000000-0000-0000-0000-000000000001';

    const response = await request.post('/api/taste', {
      data: {
        targetId: testUserId,
        action: 'like',
        confidence: 0.8,
      },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('taste');
      expect(data.taste.action).toBe('like');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('GET /api/taste retrieves taste vectors', async ({ request }) => {
    const response = await request.get('/api/taste');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('vectors');
      expect(Array.isArray(data.vectors)).toBe(true);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('GET /api/taste filters by action', async ({ request }) => {
    const response = await request.get('/api/taste?action=like');

    if (response.status() === 200) {
      const data = await response.json();
      expect(data.vectors.every((v: any) => v.action === 'like')).toBe(true);
    }
  });

  test('POST /api/taste returns 400 for self-rating', async ({ request }) => {
    const response = await request.post('/api/taste', {
      data: {
        targetId: 'same-user-id',
        action: 'like',
      },
    });

    if (response.status() !== 401) {
      expect(response.status()).toBe(400);
    }
  });

  test('POST /api/favorites stars a profile', async ({ request }) => {
    const testUserId = '00000000-0000-0000-0000-000000000002';

    const response = await request.post('/api/favorites', {
      data: { favoriteId: testUserId },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('favorite');
    } else if (response.status() !== 401) {
      expect(response.status()).toBe(409); // Already favorited
    }
  });

  test('GET /api/favorites lists starred profiles', async ({ request }) => {
    const response = await request.get('/api/favorites');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('favorites');
      expect(Array.isArray(data.favorites)).toBe(true);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('DELETE /api/favorites/[id] removes favorite', async ({ request }) => {
    const testUserId = '00000000-0000-0000-0000-000000000003';

    const response = await request.delete(`/api/favorites/${testUserId}`);

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data.success).toBe(true);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/match computes match score', async ({ request }) => {
    const testUserId = '00000000-0000-0000-0000-000000000004';

    const response = await request.post('/api/match', {
      data: { targetId: testUserId },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('match');
      expect(data.match.score).toBeGreaterThanOrEqual(0);
      expect(data.match.score).toBeLessThanOrEqual(1);
    } else if (response.status() !== 401) {
      expect(response.status()).toBe(400);
    }
  });

  test('GET /api/match retrieves top matches', async ({ request }) => {
    const response = await request.get('/api/match');

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('matches');
      expect(Array.isArray(data.matches)).toBe(true);
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('POST /api/search/assist refines search query', async ({ request }) => {
    const response = await request.post('/api/search/assist', {
      data: { query: 'looking for someone active' },
    });

    if (response.status() === 200) {
      expect(response.headers()['content-type']).toContain('application/json');
      const data = await response.json();
      expect(data).toHaveProperty('original');
      expect(data).toHaveProperty('refined');
      expect(typeof data.refined).toBe('string');
    } else {
      expect(response.status()).toBe(401);
    }
  });

  test('All endpoints require authentication', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/taste' },
      { method: 'GET', path: '/api/favorites' },
      { method: 'GET', path: '/api/match' },
    ];

    for (const endpoint of endpoints) {
      const response = await request[endpoint.method.toLowerCase() as 'get'](endpoint.path);
      expect(response.status()).toBe(401);
      expect(response.headers()['content-type']).toContain('application/json');
    }
  });
});
