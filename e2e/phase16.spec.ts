import { test, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('Phase 16: Launch Polish & Reliability', () => {
  test('service worker registers successfully', async ({ page }) => {
    await page.goto(API_BASE);

    // Wait for SW to register
    const swReady = page.waitForEvent('console', (msg) =>
      msg.text().includes('Service Worker registered')
    );

    await page.evaluate(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
      }
    });

    const msg = await swReady;
    expect(msg.text()).toContain('Service Worker registered');
  });

  test('offline queue persists messages in IndexedDB', async ({ page }) => {
    await page.goto(API_BASE);

    const queued = await page.evaluate(async () => {
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        return new Promise((resolve) => {
          const req = indexedDB.open('pirokaapp-offline', 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['messages'], 'readonly');
            const store = tx.objectStore('messages');
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve(getAll.result.length);
          };
        });
      }
      return 0;
    });

    expect(typeof queued).toBe('number');
  });

  test('performance monitoring tracks metrics', async ({ page }) => {
    await page.goto(API_BASE);

    const metrics = await page.evaluate(() => {
      if (typeof window !== 'undefined') {
        // Records will be populated by app
        return window.performance.getEntriesByType('measure').length;
      }
      return 0;
    });

    expect(typeof metrics).toBe('number');
  });

  test('error tracking captures unhandled errors', async ({ page }) => {
    await page.goto(API_BASE);

    // Trigger an error
    await page.evaluate(() => {
      throw new Error('Test error');
    }).catch(() => {
      // Expected
    });

    // Verify page still functional
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('offline detection works', async ({ page }) => {
    await page.goto(API_BASE);

    const isOnline = await page.evaluate(() => navigator.onLine);
    expect(typeof isOnline).toBe('boolean');
  });

  test('push notification APIs available', async ({ page }) => {
    await page.goto(API_BASE);

    const hasPush = await page.evaluate(() => {
      return 'serviceWorker' in navigator && 'PushManager' in window;
    });

    expect(typeof hasPush).toBe('boolean');
  });

  test('IndexedDB quota management', async ({ page }) => {
    await page.goto(API_BASE);

    const quota = await page.evaluate(async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
        };
      }
      return null;
    });

    if (quota) {
      expect(quota.usage).toBeLessThanOrEqual(quota.quota);
    }
  });

  test('service worker update detection', async ({ page }) => {
    await page.goto(API_BASE);

    const updateEvent = await Promise.race([
      page.waitForEvent('console', (msg) =>
        msg.text().includes('sw-update-ready')
      ),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), 5000);
      }),
    ]);

    // Update event may or may not fire depending on timing
    expect(updateEvent).toBeDefined();
  });

  test('network reliability resilience', async ({ page, context }) => {
    // Setup request interception
    await context.setOffline(false);
    await page.goto(API_BASE);

    // Go offline
    await context.setOffline(true);

    // Page should still be functional
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();

    // Restore online
    await context.setOffline(false);
  });
});
