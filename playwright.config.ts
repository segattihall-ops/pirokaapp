import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Start every spec past the 18+ entry gate. The declaratory AgeNotice (app/layout.tsx) covers
    // the whole viewport until `piroka_age_ack` is set, which would intercept every pointer action.
    // Seeding the cookie here makes the suite behave as an age-acknowledged visitor — the same state
    // any real session reaches after the entry screen — without weakening the gate itself.
    storageState: {
      cookies: [
        {
          name: 'piroka_age_ack',
          value: '1',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
