import { expect, test } from '@playwright/test';

const NIL = '00000000-0000-0000-0000-000000000000';

test.describe('Event privacy and authorization', () => {
  test('nearby events require authentication', async ({ request }) => {
    const response = await request.get('/api/events?lat=32.7767&lon=-96.7970&radius=10');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('event details require authentication', async ({ request }) => {
    const response = await request.get(`/api/events/${NIL}`);

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('event creation requires authentication', async ({ request }) => {
    const response = await request.post('/api/events', {
      data: {
        title: 'Private test event',
        location: { lat: 32.7767, lon: -96.7970 },
        locationName: 'Dallas, TX',
        startsAt: '2026-10-02T18:00:00.000Z',
        endsAt: '2026-10-02T20:00:00.000Z',
        category: 'meetup',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('RSVP updates require authentication', async ({ request }) => {
    const response = await request.patch(`/api/events/${NIL}/attend`, {
      data: { status: 'going' },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});
