import { test, expect } from '@playwright/test';

/**
 * OAuth return handling. Supabase sends the browser back to the Site URL (`/`) with `?code=` when the
 * requested redirect URL isn't allow-listed; the middleware must hand that code to /auth/callback.
 */
test.describe('OAuth callback', () => {
  test('a PKCE code landing on the homepage is forwarded to /auth/callback', async ({ request }) => {
    const res = await request.get('/?code=abc123', { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(res.status());
    const location = new URL(res.headers()['location'], 'http://localhost:3000');
    expect(location.pathname).toBe('/auth/callback');
    expect(location.searchParams.get('code')).toBe('abc123');
    expect(location.searchParams.get('next')).toBe('/');
  });

  test('the homepage without a code is served normally', async ({ request }) => {
    const res = await request.get('/', { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });

  test('a provider error is surfaced on the homepage as auth_error', async ({ request }) => {
    const res = await request.get('/auth/callback?error=access_denied&error_description=User%20cancelled', {
      maxRedirects: 0,
    });
    expect([302, 307, 308]).toContain(res.status());
    const location = new URL(res.headers()['location'], 'http://localhost:3000');
    expect(location.pathname).toBe('/');
    expect(location.searchParams.get('auth_error')).toBe('User cancelled');
  });

  test('the homepage renders the auth error in the sign-up chat', async ({ page }) => {
    await page.goto('/?auth_error=Access%20denied');
    await expect(page.getByText(/That sign-in didn't complete \(Access denied\)/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
