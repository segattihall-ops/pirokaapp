import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/db/client';

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@piroka.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

/** Sends to every device the user registered; drops subscriptions the push service reports as gone. */
export async function sendPushToUser(userId: string, payload: PushPayload, prefKey = 'messages'): Promise<number> {
  if (!configure() || !supabaseAdmin) return 0;

  const { data: user } = await supabaseAdmin.from('users').select('notif_prefs').eq('id', userId).maybeSingle();
  const prefs = (user?.notif_prefs ?? {}) as Record<string, boolean>;
  if (prefs[prefKey] === false) return 0;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (!subs?.length) return 0;

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        );
        sent += 1;
        await supabaseAdmin!.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabaseAdmin!.from('push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('web-push error', e?.statusCode ?? e);
        }
      }
    }),
  );
  return sent;
}
