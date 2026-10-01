import { expect, test } from '@playwright/test';

async function expectModerationOrManualReview(response: Awaited<ReturnType<Parameters<typeof test>[0]>>) {
  return response;
}

test.describe('Moderation API', () => {
  test('POST /api/moderation/assist never fails open when automation is unavailable', async ({
    request,
  }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: 'This is a normal message' },
    });

    expect(response.headers()['content-type']).toContain('application/json');
    expect([200, 502, 503]).toContain(response.status());

    const data = await response.json();

    if (response.status() === 200) {
      expect(data).toHaveProperty('moderation');
      expect(typeof data.moderation.safe).toBe('boolean');
      expect(Array.isArray(data.moderation.flags)).toBe(true);
      return;
    }

    expect(data.requiresManualReview).toBe(true);
    expect(data).not.toHaveProperty('moderation');
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

  test('POST /api/moderation/assist returns 400 for text exceeding max length', async ({
    request,
  }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: 'a'.repeat(5001) },
    });

    expect(response.status()).toBe(400);
  });

  test('successful moderation results have bounded, structured flags', async ({ request }) => {
    const response = await request.post('/api/moderation/assist', {
      data: { text: 'Hello world' },
    });

    if (response.status() !== 200) {
      expect([502, 503]).toContain(response.status());
      const data = await response.json();
      expect(data.requiresManualReview).toBe(true);
      return;
    }

    const data = await response.json();
    const { moderation } = data;

    expect(typeof moderation.safe).toBe('boolean');
    expect(Array.isArray(moderation.flags)).toBe(true);

    moderation.flags.forEach(
      (flag: { category: string; confidence: number; reason: string }) => {
        expect(flag).toHaveProperty('category');
        expect(flag).toHaveProperty('confidence');
        expect(flag).toHaveProperty('reason');
        expect(typeof flag.confidence).toBe('number');
        expect(flag.confidence).toBeGreaterThanOrEqual(0);
        expect(flag.confidence).toBeLessThanOrEqual(1);
      },
    );
  });
});
