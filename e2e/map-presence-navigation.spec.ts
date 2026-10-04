import { expect, test, type Page } from '@playwright/test';

const FAKE_ID = '11111111-1111-4111-8111-111111111111';

async function enterMap(page: Page) {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await expect(page.getByText('Welcome to πroka')).toBeVisible({ timeout: 45_000 });

  await page.getByRole('button', { name: 'Stay anonymous' }).click();
  await page.getByRole('button', { name: /Continue Anonymously/ }).click();
  for (const i of [0, 1]) {
    const box = page.getByRole('checkbox').nth(i);
    await box.click({ position: { x: 14, y: 14 } });
    if ((await box.getAttribute('aria-checked')) !== 'true')
      await box.click({ position: { x: 14, y: 14 } });
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /photo ID instead/ }).click();
  await page.getByRole('link', { name: /Enter πroka/ }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 45_000 });

  for (let i = 0; i < 8 && !/\/app\//.test(page.url()); i++) {
    if (await page.getByRole('button', { name: /^Anonymous/ }).first().isVisible().catch(() => false))
      await page.getByRole('button', { name: /^Anonymous/ }).first().click();

    const everyone = page.getByRole('button', { name: /^Everyone/ }).first();
    if ((await everyone.isVisible().catch(() => false)) && (await everyone.getAttribute('aria-pressed')) !== 'true')
      await everyone.click();

    const faceless = page.getByRole('button', { name: /Stay faceless/ });
    if (await faceless.isVisible().catch(() => false)) {
      await faceless.click();
      continue;
    }

    const next = page.getByRole('button', { name: /^(Continue|Enter πroka|Saving…)$/ }).first();
    await next.click({ timeout: 10_000 });
    await page.waitForURL(/\/app\//, { timeout: 5_000 }).catch(() => {});
  }

  if (!/\/app\//.test(page.url())) await page.goto('/app/map');
  await page.waitForURL(/\/app\/map/, { timeout: 30_000 });
}

test('map preserves marker focus and accessibility across responsive layout and the real ring tick', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(150_000);
  if (!baseURL) throw new Error('baseURL required');

  await context.grantPermissions(['geolocation'], { origin: baseURL });
  await context.setGeolocation({ latitude: 32.8109, longitude: -96.8062 });

  await page.route('**/api/me/location', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') return route.fulfill({ status: 200, json: { ok: true } });
    if (method === 'PATCH')
      return route.fulfill({ status: 200, json: { ok: true, locationRefreshRequired: false } });
    return route.fulfill({
      status: 200,
      json: { public: { lat: 32.8118, lng: -96.8071 } },
    });
  });

  await page.route('**/api/nearby?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        configured: true,
        people: [
          {
            id: FAKE_ID,
            handle: 'keyboard-test',
            lat: 32.812,
            lon: -96.807,
            distanceM: 240,
            intent: 'now',
            intentStartsAt: new Date(Date.now() - 15 * 60_000).toISOString(),
            intentEndsAt: new Date(Date.now() + 45 * 60_000).toISOString(),
            activity: 'active',
            photo: null,
            verified: true,
            plan: 'free',
          },
        ],
        hotspots: [],
        visitors: [],
      },
    }),
  );
  await page.route('**/api/me/status', (route) =>
    route.fulfill({ status: 200, json: { status: null } }),
  );
  await page.route(`**/api/users/${FAKE_ID}`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: FAKE_ID,
        handle: 'keyboard-test',
        pronouns: [],
        communities: [],
        bio: null,
        verified: true,
        plan: 'free',
        intent: 'now',
        intentEndsAt: new Date(Date.now() + 45 * 60_000).toISOString(),
        photos: [],
        albumUnlocked: false,
        albumRequest: 'none',
        favorite: false,
        favoriteAlerts: false,
        trips: [],
        conversation: false,
      },
    }),
  );

  await enterMap(page);

  const pin = page.locator(`button[data-user-id="${FAKE_ID}"]`);
  await expect(pin).toBeVisible({ timeout: 20_000 });
  await expect(pin).toHaveAttribute('aria-label', '@keyboard-test');

  await expect(page.getByRole('button', { name: /^Layers/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Filter/ })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByText('Approximate locations')).toBeVisible();
  await expect(pin).toBeVisible();

  await page.setViewportSize({ width: 430, height: 932 });
  await expect(pin).toBeVisible();

  await page.getByRole('button', { name: /^Layers/ }).click();
  const labels = page.getByRole('menuitemcheckbox', { name: 'Pin labels' });
  await expect(labels).toBeVisible();

  await pin.focus();
  await expect(pin).toBeFocused();
  await pin.evaluate((el) => {
    (el as HTMLButtonElement).dataset.e2eNode = 'same-marker';
  });

  await labels.click();
  await expect(pin).toBeFocused();
  await labels.click();
  await expect(pin).toBeFocused();

  await page.waitForTimeout(31_000);
  await expect(pin).toBeFocused();
  await expect(pin).toHaveAttribute('data-e2e-node', 'same-marker');
  await expect(pin).toHaveAttribute('aria-label', '@keyboard-test');

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('@keyboard-test')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
});
