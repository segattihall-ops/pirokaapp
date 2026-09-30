import { test, expect } from '@playwright/test';

let groupId: string;

test.describe('Groups API - Fase 6', () => {
  test('POST /api/groups creates a new group', async ({ request }) => {
    const response = await request.post('/api/groups', {
      data: {
        name: 'Test Group',
        description: 'A test group',
        location: { lat: 40.7128, lng: -74.006 },
        location_name: 'New York, NY',
      },
    });

    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');

    const group = await response.json();
    expect(group).toHaveProperty('id');
    expect(group).toHaveProperty('creator_id');
    expect(group).toHaveProperty('name');
    expect(group.name).toBe('Test Group');
    expect(group).toHaveProperty('members_count');
    expect(group.members_count).toBe(1);

    groupId = group.id;
  });

  test('GET /api/groups lists groups by location', async ({ request }) => {
    const response = await request.get('/api/groups?lat=40.7128&lng=-74.006&radius=50&limit=10');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('groups');
    expect(Array.isArray(data.groups)).toBe(true);
  });

  test('GET /api/groups returns 400 for missing location params', async ({ request }) => {
    const response = await request.get('/api/groups');

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('GET /api/groups/[id] gets group details', async ({ request }) => {
    if (!groupId) {
      test.skip();
    }

    const response = await request.get(`/api/groups/${groupId}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('group');
    expect(data.group.id).toBe(groupId);
  });

  test('POST /api/groups/[id]/join adds user to group', async ({ request }) => {
    if (!groupId) {
      test.skip();
    }

    const response = await request.post(`/api/groups/${groupId}/join`);

    // Should return 201 if successful or 409 if already member
    expect([201, 409]).toContain(response.status());
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('DELETE /api/groups/[id]/leave removes user from group', async ({ request }) => {
    if (!groupId) {
      test.skip();
    }

    const response = await request.delete(`/api/groups/${groupId}/leave`);

    // Should return 200 for success or 404 if not a member
    expect([200, 404]).toContain(response.status());
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('POST /api/groups returns 400 for invalid data', async ({ request }) => {
    const response = await request.post('/api/groups', {
      data: {
        name: '', // Empty name
        location: { lat: 40.7128, lng: -74.006 },
        location_name: 'New York',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('GET /api/groups/invalid-id returns 404', async ({ request }) => {
    const response = await request.get('/api/groups/00000000-0000-0000-0000-000000000000');

    expect(response.status()).toBe(404);
  });

  test('DELETE /api/groups/[id] deletes the group', async ({ request }) => {
    if (!groupId) {
      test.skip();
    }

    const response = await request.delete(`/api/groups/${groupId}`);

    expect(response.status()).toBe(200);

    // Verify group is deleted
    const getResponse = await request.get(`/api/groups/${groupId}`);
    expect(getResponse.status()).toBe(404);
  });
});
