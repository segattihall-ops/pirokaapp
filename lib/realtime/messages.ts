import { supabase } from '@/lib/db/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type MessagePayload = {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string; // Base64 encoded encrypted content
  kind: string;
  created_at: string;
};

export type MessageHandler = (payload: MessagePayload) => void;

/**
 * Subscribe to new messages in a conversation (realtime)
 * Returns unsubscribe function
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: MessageHandler
): (() => void) | null {
  if (!supabase) return null;

  const channel = supabase
    .channel(`conversation:${conversationId}`, {
      config: { broadcast: { self: true } }
    })
    .on(
      'postgres_changes' as const,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const message = payload.new as MessagePayload;
        onMessage(message);
      }
    )
    .subscribe((status) => {
      if (status === 'CLOSED') {
        console.log(`Messages channel closed for ${conversationId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Messages channel error for ${conversationId}`);
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to typing indicators (via presence)
 * Returns unsubscribe function
 */
export function subscribeToTypingIndicators(
  conversationId: string,
  userId: string,
  onTyping: (typingUsers: string[]) => void
): (() => void) | null {
  if (!supabase) return null;

  const channel = supabase.channel(`typing:${conversationId}`, {
    config: { presence: { key: userId } }
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const typingUsers = Object.keys(state).filter(
        (uid) => state[uid]?.[0]?.typing && uid !== userId
      );
      onTyping(typingUsers);
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      console.log(`${key} joined`);
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      console.log(`${key} left`);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Announce presence
        await channel.track({ typing: false });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Broadcast typing indicator (throttled)
 */
export async function broadcastTyping(
  conversationId: string,
  userId: string,
  isTyping: boolean
): Promise<void> {
  if (!supabase) return;

  const channel = supabase.channel(`typing:${conversationId}`);
  await channel.track({ typing: isTyping });
}

/**
 * Listen to conversation metadata changes (deleted, etc)
 */
export function subscribeToConversationChanges(
  conversationId: string,
  onUpdate: (updates: any) => void
): (() => void) | null {
  if (!supabase) return null;

  const channel = supabase
    .channel(`conv:${conversationId}`)
    .on(
      'postgres_changes' as const,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
