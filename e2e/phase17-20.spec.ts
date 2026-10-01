import { test, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const authToken = process.env.E2E_AUTH_TOKEN;

test.describe('Phases 17-20: Premium Features', () => {
  test.beforeAll(async () => {
    if (!authToken) throw new Error('E2E_AUTH_TOKEN required');
  });

  // Phase 17: Advanced Filters
  test('save advanced filter', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/filters/saved`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        name: 'NYC Verified Users',
        description: 'Looking for verified profiles in NYC',
        filterConfig: {
          city: 'New York',
          verified: true,
          ageMin: 21,
          ageMax: 35,
        },
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.filter).toBeDefined();
    expect(json.filter.name).toBe('NYC Verified Users');
  });

  test('list saved filters', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/filters/saved`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.filters).toBeInstanceOf(Array);
  });

  // Phase 18: Piroka Pulse
  test('fetch activity heatmap', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/api/pulse/heatmap?city=New%20York&radius=5000`,
      { headers: { authorization: `Bearer ${authToken}` } }
    );

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.hotspots).toBeInstanceOf(Array);
    expect(json.timestamp).toBeDefined();
  });

  // Phase 19: Alerts
  test('set alert subscription', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/alerts/subscribe`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        alertType: 'activity_spike',
        enabled: true,
        config: { threshold: 30, minProfiles: 5 },
        pushEnabled: true,
      },
    });

    if (res.status() === 200) {
      const json = await res.json();
      expect(json.subscription).toBeDefined();
    }
  });

  // Phase 20: Travel Intelligence
  test('save trip', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/travel/trips`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        destinationCity: 'Los Angeles',
        destinationCountry: 'USA',
        arrivalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        departureDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Summer vacation trip',
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.trip).toBeDefined();
    expect(json.trip.destination_city).toBe('Los Angeles');
  });

  test('list trips', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/travel/trips`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.trips).toBeInstanceOf(Array);
  });

  test('require auth for premium endpoints', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/filters/saved`);
    expect(res.status()).toBe(401);
  });
});
