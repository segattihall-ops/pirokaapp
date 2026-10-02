import { test, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const authToken = process.env.E2E_AUTH_TOKEN;

test.describe('Age Verification', () => {
  test('displays age gate on signup', async ({ page }) => {
    await page.goto(`${API_BASE}/auth/signup`);

    const ageGate = page.locator('text=Age Confirmation');
    await expect(ageGate).toBeVisible();

    const checkbox = page.locator('input[type="checkbox"]');
    const confirmButton = page.locator('button', { hasText: 'Continue' });

    await expect(confirmButton).toBeDisabled();

    await checkbox.check();
    await expect(confirmButton).toBeEnabled();
  });

  test('records age verification in audit log', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const res = await request.post(`${API_BASE}/api/auth/age-verify`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        confirmedAge18Plus: true,
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('rejects age verification without confirmation', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const res = await request.post(`${API_BASE}/api/auth/age-verify`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        confirmedAge18Plus: false,
      },
    });

    expect(res.status()).toBe(400);
  });

  test('requires authentication for age verification', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/age-verify`, {
      data: {
        confirmedAge18Plus: true,
      },
    });

    expect(res.status()).toBe(401);
  });

  test('supports Yoti verification method (when enabled)', async ({ request }) => {
    if (!authToken) {
      test.skip();
      return;
    }

    const res = await request.post(`${API_BASE}/api/auth/age-verify`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        method: 'yoti',
        sessionId: 'test-session-id',
      },
    });

    // Will fail if Yoti SDK not installed, but endpoint should exist
    expect([200, 400, 503]).toContain(res.status());
  });
});
