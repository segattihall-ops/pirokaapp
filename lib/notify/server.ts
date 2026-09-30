import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { sendPushToUser } from '@/lib/push/server';

export type NotifKind =
  | 'message'
  | 'match'
  | 'album'
  | 'album_request'
  | 'album_grant'
  | 'favorite'
  | 'arrival'
  | 'status'
  | 'safety'
  | 'call';

/** Which "Notify me about" switch governs each kind (see /api/me/prefs). */
const PREF_OF: Record<NotifKind, string> = {
  message: 'messages',
  call: 'messages',
  match: 'match',
  album: 'album',
  album_request: 'album',
  album_grant: 'album',
  favorite: 'match',
  arrival: 'arrival',
  status: 'status',
  safety: 'safety',
};

export type Notice = { kind: NotifKind; title: string; body: string; url?: string; refUser?: string | null };

/**
 * Stores a notification row for the bell and pushes it to the user's devices.
 * Silently skipped when the user switched that category off. Never throws.
 */
export async function notify(userId: string, n: Notice): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data: u } = await supabaseAdmin.from('users').select('notif_prefs, deleted_at').eq('id', userId).maybeSingle();
    if (!u || u.deleted_at) return false;
    const prefs = (u.notif_prefs ?? {}) as Record<string, boolean>;
    if (prefs[PREF_OF[n.kind]] === false) return false;

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url ?? null,
      ref_user: n.refUser ?? null,
    });
    sendPushToUser(userId, { title: n.title, body: n.body, url: n.url, tag: `${n.kind}-${n.refUser ?? userId}` }, PREF_OF[n.kind]).catch(
      (e) => console.error('push failed', e),
    );
    return true;
  } catch (e) {
    console.error('notify failed', e);
    return false;
  }
}

/** Fan-out helper: same notice to many users, ignoring failures. */
export async function notifyMany(userIds: string[], n: Notice): Promise<number> {
  const results = await Promise.all([...new Set(userIds)].map((id) => notify(id, n)));
  return results.filter(Boolean).length;
}
