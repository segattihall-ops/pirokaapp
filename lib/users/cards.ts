import 'server-only';
import { supabaseAdmin } from '@/lib/db/client';
import { photoUrl } from '@/lib/upload/storage';

export type UserCard = {
  id: string;
  handle: string | null;
  photo: string | null;
  verified: boolean;
  intent: string | null;
  intentEndsAt: string | null;
};

/** Small public cards (blurred main photo) for lists: favourites, requests, notifications. */
export async function userCards(ids: string[]): Promise<Map<string, UserCard>> {
  const out = new Map<string, UserCard>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!supabaseAdmin || unique.length === 0) return out;

  const now = new Date().toISOString();
  const [{ data: users }, { data: photos }, { data: statuses }] = await Promise.all([
    supabaseAdmin.from('users').select('id, handle, verified_at, deleted_at').in('id', unique),
    supabaseAdmin.from('photos').select('user_id, blur_key').in('user_id', unique).eq('slot', 0),
    supabaseAdmin.from('statuses').select('user_id, intent, ends_at').in('user_id', unique).gt('ends_at', now),
  ]);
  const photoOf = new Map((photos ?? []).map((p) => [p.user_id, p.blur_key as string]));
  const statusOf = new Map((statuses ?? []).map((s) => [s.user_id, s]));
  for (const u of users ?? []) {
    if (u.deleted_at) continue;
    const blur = photoOf.get(u.id);
    const s = statusOf.get(u.id);
    out.set(u.id, {
      id: u.id,
      handle: u.handle ?? null,
      photo: blur ? photoUrl(blur) : null,
      verified: Boolean(u.verified_at),
      intent: s?.intent ?? null,
      intentEndsAt: s?.ends_at ?? null,
    });
  }
  return out;
}

export const displayName = (handle: string | null | undefined) => (handle ? `@${handle}` : 'Someone');
