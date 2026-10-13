import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { rateLimit, tooMany } from '@/lib/api/rate-limit';
import { track } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';
import { withApi } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

/**
 * "Download my data": everything stored about the account as one JSON file. Excludes message
 * ciphertext (unreadable without the device keys) and other people's data. Three downloads per day.
 */
export const GET = withApi('/api/me/export', async () => {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  if (!(await rateLimit(`export:${me}`, 3, 86400))) return tooMany();
  const db = supabaseAdmin!;

  const pick = async (table: string, cols: string, col = 'user_id') => {
    const { data } = await db.from(table).select(cols).eq(col, me).limit(2000);
    return data ?? [];
  };

  const [user, photos, statuses, trips, favorites, albumGrants, albumRequests, checkins, notifications, payments, events, emails, feedback, reportsFiled, blocks] =
    await Promise.all([
      db
        .from('users')
        .select('id, created_at, auth_provider, email, handle, pronouns, gender, orientation, communities, show_me, bio, plan, visibility, age_verified, safety_prefs, notif_prefs, marketing_opt_out, disguise_icon, subscription_status')
        .eq('id', me)
        .maybeSingle(),
      pick('photos', 'slot, created_at'),
      pick('statuses', 'intent, starts_at, ends_at'),
      pick('trips', 'city, arrive_on, nights'),
      pick('favorites', 'fav_id, alerts, created_at'),
      pick('album_grants', 'grantee_id, granted_at, revoked_at', 'owner_id'),
      pick('album_requests', 'to_id, status, created_at', 'from_id'),
      pick('checkins', 'place_id, kind, expires_at'),
      pick('notifications', 'kind, title, body, url, read_at, created_at'),
      pick('payments', 'payment_id, amount, currency, status, description, created_at'),
      pick('analytics_events', 'event, props, path, created_at'),
      pick('email_log', 'template, subject, status, created_at'),
      pick('feedback', 'kind, message, status, created_at'),
      pick('reports', 'reason, status, created_at', 'reporter_id'),
      pick('blocks', 'blocked_id, created_at', 'blocker_id'),
    ]);

  void track({ userId: me, event: EVENTS.data_exported });
  const body = {
    exportedAt: new Date().toISOString(),
    note: 'Location is not included: πroka keeps only a fuzzed position for 24 hours. Chat messages are end-to-end encrypted and only readable on your devices.',
    profile: user.data,
    photos,
    statuses,
    trips,
    favorites,
    album: { grants: albumGrants, requests: albumRequests },
    checkins,
    notifications,
    payments,
    analyticsEvents: events,
    emails,
    feedback,
    reportsFiled,
    blocks,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="piroka-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
