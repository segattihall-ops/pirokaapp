import { test, expect } from '@playwright/test';

let groupId: string;

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

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/groups returns JSON (not HTML)', async ({ request }) => {
    const response = await request.post('/api/groups', {
      data: {
        name: 'Test Group',
        description: 'A test group',
        location: { lat: 40.7128, lng: -74.006 },
        location_name: 'New York, NY',
      },
    });

    // Ensure response is JSON, not HTML
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);

    // Should be valid JSON (even if it's an error)
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('GET /api/groups returns 400 for missing location params', async ({ request }) => {
    const response = await request.get('/api/groups');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/groups returns JSON with proper structure', async ({ request }) => {
    const response = await request.get('/api/groups?lat=40.7128&lng=-74.006&radius=50&limit=10');

    // Should return valid JSON response
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);

    const data = await response.json();
    expect(data).toBeDefined();
    if (response.status() === 200) {
      expect(data).toHaveProperty('groups');
      expect(Array.isArray(data.groups)).toBe(true);
    }
  });

  test('GET /api/groups/[id] returns JSON (not HTML)', async ({ request }) => {
    const response = await request.get('/api/groups/00000000-0000-0000-0000-000000000000');

    // Ensure response is JSON, not HTML
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);

    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('POST /api/groups/[id]/join requires authentication', async ({ request }) => {
    const response = await request.post('/api/groups/00000000-0000-0000-0000-000000000000/join');

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('DELETE /api/groups/[id]/leave requires authentication', async ({ request }) => {
    const response = await request.delete('/api/groups/00000000-0000-0000-0000-000000000000/leave');

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/groups returns JSON for invalid data', async ({ request }) => {
    const response = await request.post('/api/groups', {
      data: {
        name: '', // Empty name
        location: { lat: 40.7128, lng: -74.006 },
        location_name: 'New York',
      },
    });

    // Ensure response is JSON, not HTML
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.status()).not.toBe(500);
  });

  test('DELETE /api/groups/[id] requires authentication', async ({ request }) => {
    const response = await request.delete('/api/groups/00000000-0000-0000-0000-000000000000');

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('PATCH /api/groups/[id] requires authentication', async ({ request }) => {
    const response = await request.patch('/api/groups/00000000-0000-0000-0000-000000000000', {
      data: { name: 'Updated Name' },
    });

    // Should return 401 when not authenticated (JSON response)
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});
