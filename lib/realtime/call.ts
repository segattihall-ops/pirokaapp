import { getSupabase } from '@/lib/db/client-side';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Signalling for 1:1 WebRTC calls over a Supabase broadcast channel (no rows stored, nothing persisted).
 * Both sides join `call:<conversationId>`; every message carries the sender id so each side ignores its own echoes.
 */
export type CallSignal =
  | { type: 'ring' }
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'busy' }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'hangup' };

export type Signaler = {
  send: (s: CallSignal) => Promise<void>;
  close: () => void;
};

export function iceServers(): RTCIceServer[] {
  const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      console.warn('NEXT_PUBLIC_ICE_SERVERS is not valid JSON; using public STUN only');
    }
  }
  return [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
}

export function joinCallChannel(
  conversationId: string,
  userId: string,
  onSignal: (s: CallSignal, from: string) => void,
  onStatus?: (live: boolean) => void,
): Signaler {
  const sb = getSupabase();
  if (!sb) return { send: async () => {}, close: () => {} };
  let channel: RealtimeChannel | null = null;
  let closed = false;
  let ready: (() => void) | null = null;
  const live = new Promise<void>((r) => (ready = r));

  sb.auth.getSession().then(({ data }) => {
    if (closed) return;
    if (data.session?.access_token) sb.realtime.setAuth(data.session.access_token);
    channel = sb
      .channel(`call:${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const p = payload as { from: string; signal: CallSignal };
        if (p?.from && p.from !== userId && p.signal) onSignal(p.signal, p.from);
      })
      .subscribe((status) => {
        const ok = status === 'SUBSCRIBED';
        onStatus?.(ok);
        if (ok) ready?.();
      });
  });

  return {
    send: async (signal) => {
      if (closed) return;
      await Promise.race([live, new Promise((r) => setTimeout(r, 4000))]);
      if (!channel) return;
      await channel.send({ type: 'broadcast', event: 'signal', payload: { from: userId, signal } });
    },
    close: () => {
      closed = true;
      if (channel) sb.removeChannel(channel);
    },
  };
}
