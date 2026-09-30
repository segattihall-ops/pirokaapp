import { test, expect } from '@playwright/test';

test.describe('Moderation API', () => {
  test('POST /api/moderation/assist returns JSON with moderation result', async ({ request }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: 'This is a normal message' },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('moderation');
    expect(data.moderation).toHaveProperty('safe');
    expect(data.moderation).toHaveProperty('flags');
  });

  test('POST /api/moderation/assist returns 400 for missing text', async ({ request }) => {
    const response = await request.post('/api/moderation/assist', {
      data: {},
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/moderation/assist returns 400 for empty text', async ({ request }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: '' },
    });

    expect(response.status()).toBe(400);
  });

  test('POST /api/moderation/assist returns 400 for text exceeding max length', async ({ request }) => {
    const longText = 'a'.repeat(5001);
    const response = await request.post('/api/moderation/assist', {
      data: { text: longText },
    });

    expect(response.status()).toBe(400);
  });

  test('moderation result has correct structure', async ({ request }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: 'Hello world' },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    const { moderation } = data;

    expect(typeof moderation.safe).toBe('boolean');
    expect(Array.isArray(moderation.flags)).toBe(true);

    moderation.flags.forEach((flag: any) => {
      expect(flag).toHaveProperty('category');
      expect(flag).toHaveProperty('confidence');
      expect(flag).toHaveProperty('reason');
      expect(typeof flag.confidence).toBe('number');
      expect(flag.confidence).toBeGreaterThanOrEqual(0);
      expect(flag.confidence).toBeLessThanOrEqual(1);
    });
  });
});
