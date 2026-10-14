import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

/**
 * Walks the whole product as a brand-new anonymous member: homepage chat → consent → age check →
 * onboarding → map, status, pulse, profile + favourite, chats (E2E message), places (+ tabs, check-in),
 * ME, edit profile (+ photo upload), help, account, admin gate. Records every console error, page
 * error and failed response, and screenshots each screen. Run via e2e/remote.config.ts.
 */
const OUT = process.env.SMOKE_OUT ?? 'test-results/smoke';
type Step = { name: string; ok: boolean; note?: string; error?: string };
const report = {
  baseURL: '',
  steps: [] as Step[],
  consoleErrors: [] as string[],
  pageErrors: [] as string[],
  failedResponses: [] as { url: string; status: number; method: string }[],
};

test.skip(!process.env.SMOKE_BASE_URL, 'Set SMOKE_BASE_URL to run the full-app smoke against a deployment');

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}
let aborted = false;
async function step(page: Page, name: string, fn: () => Promise<string | void>) {
  if (aborted) {
    report.steps.push({ name, ok: false, error: 'skipped: an earlier gate step failed' });
    return;
  }
  try {
    const note = await fn();
    report.steps.push({ name, ok: true, ...(note ? { note } : {}) });
  } catch (e) {
    report.steps.push({ name, ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 400) });
    await shot(page, `FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}`);
    // Steps 01–05 get the member through the gate; without them nothing later can run.
    if (/^0[1-5] /.test(name)) aborted = true;
  }
}
const visible = (l: ReturnType<Page['locator']>, ms = 1500) =>
  l
    .first()
    .isVisible({ timeout: ms })
    .catch(() => false);

test('full app smoke as a new anonymous member', async ({ page, baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  report.baseURL = baseURL ?? '';
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e.message).slice(0, 300)));
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.startsWith(baseURL ?? ''))
      report.failedResponses.push({
        url: u.replace(baseURL ?? '', ''),
        status: r.status(),
        method: r.request().method(),
      });
  });

  await step(page, '01 homepage', async () => {
    await page.goto('/');
    await expect(page.getByText('Welcome to πroka')).toBeVisible({ timeout: 45_000 });
    await shot(page, '01-home');
  });

  await step(page, '02 anonymous sign-in', async () => {
    await page.getByRole('button', { name: 'Stay anonymous' }).click({ timeout: 20_000 });
    await page.getByRole('button', { name: /Continue Anonymously/ }).click({ timeout: 15_000 });
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 45_000 });
    await shot(page, '02-consent');
  });

  await step(page, '03 consent (18+ and terms)', async () => {
    // Click the box itself (left edge): the second row also holds policy links.
    for (const i of [0, 1]) {
      const box = page.getByRole('checkbox').nth(i);
      await box.click({ position: { x: 14, y: 14 }, timeout: 10_000 });
      if ((await box.getAttribute('aria-checked')) !== 'true')
        await box.click({ position: { x: 14, y: 14 } });
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /photo ID instead/ })).toBeVisible({ timeout: 30_000 });
  });

  await step(page, '04 age check (photo ID path)', async () => {
    await page.getByRole('button', { name: /photo ID instead/ }).click();
    await expect(page.getByRole('link', { name: /Enter πroka/ })).toBeVisible({ timeout: 60_000 });
    await shot(page, '03-verified');
    await page.getByRole('link', { name: /Enter πroka/ }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 45_000 });
  });

  await step(page, '05 onboarding', async () => {
    let i = 0;
    while (!/\/app\//.test(page.url()) && i < 8) {
      i++;
      await page.waitForTimeout(700);
      if (await visible(page.getByRole('button', { name: /^Anonymous/ })))
        await page
          .getByRole('button', { name: /^Anonymous/ })
          .first()
          .click();
      const everyone = page.getByRole('button', { name: /^Everyone/ }).first();
      if ((await visible(everyone)) && (await everyone.getAttribute('aria-pressed')) !== 'true')
        await everyone.click();
      await shot(page, `04-onboarding-${i}`);
      if (await visible(page.getByRole('button', { name: /Stay faceless/ }))) {
        await page.getByRole('button', { name: /Stay faceless/ }).click();
        continue;
      }
      const next = page.getByRole('button', { name: /^(Continue|Enter πroka|Saving…)$/ }).first();
      await next.click({ timeout: 10_000 });
      await page.waitForURL(/\/app\//, { timeout: 20_000 }).catch(() => {});
    }
    if (!/\/app\//.test(page.url())) {
      // Demo mode (no Supabase keys): /api/onboarding/save answers 503. The gate itself is passed, so
      // walk straight into the app to keep exercising the screens.
      const err = await page
        .getByRole('alert')
        .textContent()
        .catch(() => '');
      await page.goto('/app/map');
      await page.waitForURL(/\/app\/map/, { timeout: 30_000 });
      return `${i} screen(s); save failed (${(err ?? '').trim() || 'no message'}) — entered the app directly`;
    }
    return `${i} screen(s)`;
  });

  await step(page, '06 map: pins, layers, filters, responsive', async () => {
    await page.waitForTimeout(5000);
    await expect(page.getByRole('button', { name: /^Layers/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Filter/ })).toBeVisible({ timeout: 15_000 });
    await shot(page, '05-map-mobile');

    const layers = page.getByRole('button', { name: /^Layers/ });
    await layers.click();
    const peopleLayer = page.getByRole('menuitemcheckbox', { name: 'People pins' });
    await expect(peopleLayer).toHaveAttribute('aria-checked', 'true');
    await peopleLayer.click();
    await expect(peopleLayer).toHaveAttribute('aria-checked', 'false');
    await peopleLayer.click();
    await expect(peopleLayer).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: /^Filter/ }).click();
    const photosOnly = page.getByRole('button', { name: /Has a photo/ });
    await photosOnly.click();
    await expect(photosOnly).toHaveAttribute('aria-pressed', 'true');
    const recentOnly = page.getByRole('button', { name: /Recent on map/ });
    await recentOnly.click();
    await expect(recentOnly).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(photosOnly).toHaveAttribute('aria-pressed', 'false');
    await expect(recentOnly).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: /^Filter/ }).click();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.getByText('Approximate locations')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Layers/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Filter/ })).toBeVisible();
    await shot(page, '05-map-desktop');
    await page.setViewportSize({ width: 430, height: 932 });
    await shot(page, '05-map-mobile-restored');

    const heartbeatStatus = await page.evaluate(async () => {
      const response = await fetch('/api/me/location', { method: 'PATCH', cache: 'no-store' });
      return response.status;
    });
    if (heartbeatStatus !== 503 && heartbeatStatus >= 400)
      throw new Error(`presence heartbeat → ${heartbeatStatus}`);

    // Returning to a visible map must republish a bounded/fuzzed location capture rather than
    // merely making an old coordinate look freshly active.
    const resumeLocationResponse = page.waitForResponse(
      (r) => r.url().includes('/api/me/location') && r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const resumedLocation = await resumeLocationResponse;
    if (resumedLocation.status() !== 503 && resumedLocation.status() >= 400)
      throw new Error(`resume location refresh → ${resumedLocation.status()}`);

    if (await visible(page.getByText(/needs Supabase/)))
      return 'controls responsive; demo mode: no Supabase keys, discovery/places/chat data unavailable';

    const pin = page.locator('button[data-user-id]').first();
    if (await visible(pin, 3000)) {
      await expect(pin).toHaveAttribute('data-activity', /active|recent|today/);
      await expect(pin).toHaveAttribute('aria-label', /^(?:@.+|Member)$/);
      const pinId = await pin.getAttribute('data-user-id');
      if (!pinId) throw new Error('person pin missing data-user-id');

      await page.getByRole('button', { name: /^Layers/ }).evaluate((el) => (el as HTMLButtonElement).click());
      const pinLabels = page.getByRole('menuitemcheckbox', { name: 'Pin labels' });
      await expect(pinLabels).toBeVisible();

      await pin.focus();
      await expect(pin).toBeFocused();

      await pinLabels.evaluate((el) => (el as HTMLButtonElement).click());
      await expect(pinLabels).toHaveAttribute('aria-checked', 'false');
      const stablePin = page.locator(`button[data-user-id="${pinId}"]`).first();
      await expect(stablePin).toBeFocused();

      await pinLabels.evaluate((el) => (el as HTMLButtonElement).click());
      await expect(pinLabels).toHaveAttribute('aria-checked', 'true');
      await expect(stablePin).toBeFocused();

      // Cross an actual 30-second ring tick. The exact same marker button must retain focus.
      await page.waitForTimeout(31_000);
      await expect(stablePin).toBeFocused();
      await expect(stablePin).toHaveAttribute('aria-label', /^(?:@.+|Member)$/);

      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

      return 'controls responsive; heartbeat + resume location refresh verified; pin focus survives a real 30s ring tick and keyboard activation works';
    }
    return 'controls responsive; heartbeat + resume location refresh verified; no people nearby for keyboard pin check';
  });

  await step(page, '07 status: go live (PIROKA Mode)', async () => {
    await page
      .getByRole('button', { name: /Set your intent|^You:/ })
      .first()
      .click({ timeout: 10_000 });
    await page.getByRole('button', { name: /^Available now/ }).click({ timeout: 10_000 });
    await shot(page, '06-status-sheet');
    await page
      .getByRole('button', { name: /^(Go live|Update)$/ })
      .last()
      .click({ timeout: 10_000 });
    await page.waitForTimeout(2000);
    await shot(page, '06-status-live');
  });

  await step(page, '08 pulse', async () => {
    await page.goto('/app/pulse');
    await page.waitForTimeout(4000);
    await shot(page, '07-pulse');
  });

  await step(page, '09 profile sheet + favourite', async () => {
    const row = page.locator('button.tap-hit').first();
    if (!(await visible(row, 3000))) return 'no people nearby to open';
    await row.click();
    await expect(page.getByRole('button', { name: /favourites/i })).toBeVisible({ timeout: 15_000 });
    await shot(page, '08-profile');
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/favorites'), { timeout: 15_000 }),
      page.getByRole('button', { name: /favourites/i }).click(),
    ]);
    if (res.status() >= 400)
      throw new Error(`POST /api/favorites → ${res.status()} ${(await res.text()).slice(0, 200)}`);
    await page.waitForTimeout(800);
    await shot(page, '08-profile-favourited');
    await page
      .getByRole('button', { name: 'Close' })
      .first()
      .click()
      .catch(() => {});
  });

  await step(page, '10 chats: start by handle + send E2E message', async () => {
    await page.goto('/app/chats');
    await page.getByPlaceholder(/Start a chat by @handle/).fill('Pirocudo');
    const [startRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/chat/start'), { timeout: 30_000 }),
      page.getByRole('button', { name: 'Chat', exact: true }).click(),
    ]);
    if (startRes.status() === 503) return 'demo mode: chat needs Supabase';
    if (startRes.status() >= 400)
      throw new Error(`POST /api/chat/start → ${startRes.status()} ${(await startRes.text()).slice(0, 200)}`);
    await page.waitForURL(/\/app\/chats\/[0-9a-f-]+/, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    const box = page.getByPlaceholder(/Message|Type a message/);
    await box.fill('Oi! Teste automático do πroka 🚀');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await expect(page.getByText('Oi! Teste automático do πroka 🚀')).toBeVisible({ timeout: 20_000 });
    await shot(page, '09-chat');
    await page.goto('/app/chats');
    await page.waitForTimeout(2500);
    await shot(page, '09-chats-list');
  });

  await step(page, '11 places + tabs + check-in', async () => {
    await page.goto('/app/places');
    await page.waitForTimeout(5000);
    await shot(page, '10-places');
    const noPlaces = await visible(page.getByText(/No places within/));
    for (const tab of ['Events', 'Testing']) {
      const t = page.getByRole('tab', { name: tab });
      if (await visible(t)) {
        await t.click();
        await page.waitForTimeout(3000);
        await shot(page, `10-places-${tab.toLowerCase()}`);
      }
    }
    if (await visible(page.getByRole('tab', { name: 'Places' })))
      await page.getByRole('tab', { name: 'Places' }).click();
    if (noPlaces) return 'no places within 10 miles on this deployment';
    const here = page.getByRole('button', { name: "I'm here" }).first();
    if (await visible(here, 5000)) {
      await here.click();
      await expect(page.getByRole('button', { name: /^Here ·/ }).first()).toBeVisible({ timeout: 15_000 });
      await shot(page, '10-places-checkedin');
      await page
        .getByRole('button', { name: /^Here ·/ })
        .first()
        .click();
      await page.waitForTimeout(1500);
    }
  });

  await step(page, '12 ME', async () => {
    const favRes = page
      .waitForResponse((r) => r.url().includes('/api/favorites') && r.request().method() === 'GET', {
        timeout: 20_000,
      })
      .catch(() => null);
    await page.goto('/app/me');
    const r = await favRes;
    await page.waitForTimeout(2500);
    await shot(page, '11-me');
    if (r && r.status() === 503) return 'demo mode: favourites need Supabase';
    if (r && r.status() >= 400) throw new Error(`GET /api/favorites → ${r.status()}`);
  });

  await step(page, '13 edit profile + photo upload + save', async () => {
    await page.goto('/app/me/edit');
    await page.waitForTimeout(3000);
    await shot(page, '12-edit-profile');
    const jpg = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: { r: 52, g: 211, b: 153 } },
    })
      .composite([
        {
          input: await sharp({ create: { width: 500, height: 500, channels: 3, background: '#111' } })
            .png()
            .toBuffer(),
          top: 550,
          left: 350,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
    const input = page.locator('input[type="file"]').first();
    if ((await input.count()) === 0) {
      const msg =
        (await page
          .getByRole('alert')
          .textContent()
          .catch(() => '')) ?? '';
      return `no photo input rendered (${msg.trim() || 'profile did not load'})`;
    }
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/photos/upload'), { timeout: 60_000 }),
      input.setInputFiles({ name: 'smoke.jpg', mimeType: 'image/jpeg', buffer: jpg }),
    ]);
    if (res.status() >= 400)
      throw new Error(`photo upload → ${res.status()} ${(await res.text()).slice(0, 200)}`);
    await page.waitForTimeout(3000);
    await shot(page, '12-edit-profile-photo');
    const save = page.getByRole('button', { name: /^Save/ }).first();
    if (await visible(save)) {
      await save.click();
      await page.waitForTimeout(2500);
    }
    await page.goto('/app/me');
    await page.waitForTimeout(2500);
    await shot(page, '11-me-with-photo');
  });

  await step(page, '14 help, account, admin gate', async () => {
    await page.goto('/help/terms');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
    await shot(page, '13-help-terms');
    await page.goto('/account');
    await page.waitForTimeout(2000);
    await shot(page, '14-account');
    await page.goto('/admin');
    await page.waitForTimeout(2500);
    await shot(page, '15-admin');
    return `admin landed on ${new URL(page.url()).pathname}`;
  });

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  const failed = report.steps.filter((s) => !s.ok);
  console.log(
    `\nSMOKE ${report.baseURL}: ${report.steps.length - failed.length}/${report.steps.length} steps ok`,
  );
  for (const s of report.steps)
    console.log(
      ` ${s.ok ? '✓' : '✗'} ${s.name}${s.note ? ` — ${s.note}` : ''}${s.error ? ` — ${s.error}` : ''}`,
    );
  console.log(` failed responses: ${report.failedResponses.length}`);
  for (const f of report.failedResponses) console.log(`   ${f.status} ${f.method} ${f.url}`);
  console.log(` console errors: ${report.consoleErrors.length}; page errors: ${report.pageErrors.length}`);
  for (const e of [...report.pageErrors, ...report.consoleErrors].slice(0, 15)) console.log(`   ${e}`);
});
