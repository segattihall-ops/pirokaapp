import { expect, test } from '@playwright/test';

const NIL = '00000000-0000-0000-0000-000000000000';

test.describe('Groups API - Fase 6', () => {
  test('POST /api/groups requires authentication', async ({ request }) => {
    const response = await request.post('/api/groups', {
      data: {
        name: 'Test Group',
        description: 'A test group',
        location: { lat: 40.7128, lng: -74.006 },
        location_name: 'New York, NY',
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/groups validates location input', async ({ request }) => {
    const response = await request.get('/api/groups');
    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/groups never returns raw coordinates', async ({ request }) => {
    const response = await request.get(
      '/api/groups?lat=40.7128&lng=-74.006&radius=50&limit=10',
    );

    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data.groups)).toBe(true);
      for (const group of data.groups) {
        expect(group).not.toHaveProperty('location');
        expect(group).not.toHaveProperty('lat');
        expect(group).not.toHaveProperty('lng');
        expect(group).toHaveProperty('distance_km');
      }
    }
  });

  test('GET /api/groups/[id] requires authentication', async ({ request }) => {
    const response = await request.get(`/api/groups/${NIL}`);
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/groups/[id]/join requires authentication', async ({ request }) => {
    const response = await request.post(`/api/groups/${NIL}/join`);
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/groups/[id]/leave requires authentication', async ({ request }) => {
    const response = await request.delete(`/api/groups/${NIL}/leave`);
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/groups/[id] requires authentication', async ({ request }) => {
    const response = await request.delete(`/api/groups/${NIL}`);
    expect(response.status()).toBe(401);
  });

  test('PATCH /api/groups/[id] requires authentication', async ({ request }) => {
    const response = await request.patch(`/api/groups/${NIL}`, {
      data: { name: 'Updated Name' },
    });
    expect(response.status()).toBe(401);
  });
});
