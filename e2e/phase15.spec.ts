import { test, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const authToken = process.env.E2E_AUTH_TOKEN;

test.describe('Phase 15: Growth & Referrals', () => {
  test.beforeAll(async () => {
    if (!authToken) throw new Error('E2E_AUTH_TOKEN required');
  });

  test('create referral code', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: {
        code: 'REFER123',
        rewardCredits: 150,
        maxUses: 10,
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.code).toBeDefined();
    expect(json.code.code).toBe('REFER123');
    expect(json.code.reward_credits).toBe(150);
    expect(json.code.max_uses).toBe(10);
  });

  test('list user referral codes', async ({ request }) => {
    // Create a code first
    await request.post(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { code: 'LIST001', rewardCredits: 100 },
    });

    const res = await request.get(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.codes).toBeInstanceOf(Array);
    expect(json.codes.length).toBeGreaterThan(0);
  });

  test('record XP for actions', async ({ request }) => {
    const actions = [
      { action: 'profile_complete', amount: 50 },
      { action: 'message_sent', amount: 5 },
      { action: 'photo_verified', amount: 25 },
    ];

    for (const xp of actions) {
      const res = await request.post(`${API_BASE}/api/xp`, {
        headers: { authorization: `Bearer ${authToken}` },
        data: xp,
      });

      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.xp).toBeDefined();
      expect(json.totalXP).toBeGreaterThan(0);
    }
  });

  test('fetch user XP stats', async ({ request }) => {
    // Record some XP first
    await request.post(`${API_BASE}/api/xp`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { action: 'message_sent', amount: 10 },
    });

    const res = await request.get(`${API_BASE}/api/xp`, {
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.totalXP).toBeGreaterThan(0);
    expect(json.messagesSent).toBeDefined();
    expect(json.photosVerified).toBeDefined();
  });

  test('fetch leaderboard', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/leaderboard?metric=weekly_xp&limit=10`);

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.metric).toBe('weekly_xp');
    expect(json.entries).toBeInstanceOf(Array);
  });

  test('validate referral code format', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { code: 'invalid@code' }, // Invalid format
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  test('prevent duplicate referral codes', async ({ request }) => {
    const code = `DUP${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Create first
    const res1 = await request.post(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { code },
    });
    expect(res1.status()).toBe(200);

    // Try to create duplicate
    const res2 = await request.post(`${API_BASE}/api/referrals/codes`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { code },
    });
    expect(res2.status()).toBe(409);
  });

  test('XP amount defaults', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/xp`, {
      headers: { authorization: `Bearer ${authToken}` },
      data: { action: 'profile_complete' },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.xp.amount).toBe(50); // Default for profile_complete
  });

  test('require auth for XP endpoints', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/xp`);
    expect(res.status()).toBe(401);
  });

  test('require auth for referral endpoints', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/referrals/codes`);
    expect(res.status()).toBe(401);
  });
});
