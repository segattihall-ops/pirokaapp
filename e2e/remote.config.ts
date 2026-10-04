import { defineConfig, devices } from '@playwright/test';

/**
 * Full-app smoke run against a deployed URL (production or a Vercel preview):
 *   SMOKE_BASE_URL=https://www.pirokaapp.com npx playwright test --config e2e/remote.config.ts
 * Optional: SMOKE_BYPASS=<Vercel protection-bypass secret> for protected previews,
 *           SMOKE_OUT=<dir> for screenshots + report.json.
 */
const bypass = process.env.SMOKE_BYPASS;

export default defineConfig({
  testDir: '.',
  testMatch: /smoke\.full\.spec\.ts/,
  timeout: 900_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 430, height: 932 },
    geolocation: { latitude: 32.8107, longitude: -96.8109 }, // Oak Lawn, Dallas
    permissions: ['geolocation', 'camera'],
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
      : {},
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    // The sandbox routes HTTPS through a proxy with its own CA; the smoke run is not a TLS test.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
});
