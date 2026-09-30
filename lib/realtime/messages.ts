import { getSupabase } from '@/lib/db/client-side';
import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';

export type MessageRow = {
  id: number;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  kind: string;
  created_at: string;
};

/** Realtime checks RLS with the token the channel joins with, so the session must be attached first. */
async function withAuth(sb: SupabaseClient): Promise<void> {
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) await sb.realtime.setAuth(data.session.access_token);
}

/**
 * New rows in `dm_messages` for one conversation. Requires the RLS select policy + realtime publication.
 * `onStatus(true)` once the channel is live; callers poll while it is not.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (row: MessageRow) => void,
  onStatus?: (live: boolean) => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  let channel: RealtimeChannel | null = null;
  let closed = false;

  withAuth(sb).then(() => {
    if (closed) return;
    channel = sb
      .channel(`dm:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => onMessage(payload.new as MessageRow),
      )
      .subscribe((status, err) => {
        onStatus?.(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('realtime messages:', status, err?.message);
      });
  });

  return () => {
    closed = true;
    if (channel) sb.removeChannel(channel);
  };
}

export type TypingController = { setTyping: (typing: boolean) => void; unsubscribe: () => void };

/** Presence-based typing indicator on a per-conversation channel. */
export function subscribeToTyping(
  conversationId: string,
  userId: string,
  onTyping: (typingUserIds: string[]) => void,
): TypingController {
  const sb = getSupabase();
  if (!sb) return { setTyping: () => {}, unsubscribe: () => {} };

  let channel: RealtimeChannel | null = null;
  let ready = false;
  let closed = false;
  let last = false;

  withAuth(sb).then(() => {
    if (closed) return;
    channel = sb.channel(`typing:${conversationId}`, { config: { presence: { key: userId } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState() as Record<string, { typing?: boolean }[]>;
        onTyping(Object.keys(state).filter((uid) => uid !== userId && state[uid]?.some((p) => p.typing)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          ready = true;
          await channel!.track({ typing: last });
        }
      });
  });

  return {
    setTyping: (typing) => {
      last = typing;
      if (ready && channel) channel.track({ typing }).catch(() => {});
    },
    unsubscribe: () => {
      closed = true;
      if (channel) sb.removeChannel(channel);
    },
  };
}
