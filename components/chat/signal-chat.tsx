'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeEnvelope, encodeEnvelope } from '@/lib/chat/envelope';
import { fromB64 } from '@/lib/encryption/primitives';
import { decryptFromConversation, encryptForConversation, peerIdentityKey, type Envelope } from '@/lib/encryption/signal-session';
import { cachePlaintext, getCachedPlaintext } from '@/lib/encryption/signal-store';
import { fingerprint } from '@/lib/encryption/x3dh';
import { subscribeToMessages, subscribeToTyping, type MessageRow, type TypingController } from '@/lib/realtime/messages';
import { SafetyMenu } from './safety-menu';
import { VideoCall } from './video-call';

type Msg = { id: number; mine: boolean; text: string | null; at: string; failed?: boolean };

const outgoingKey = (env: Envelope) => `${env.msg.header.dh}:${env.msg.header.n}`;

export function SignalChat({
  conversationId,
  userId,
  peerUserId,
  peerHandle,
}: {
  conversationId: string;
  userId: string;
  peerUserId: string;
  peerHandle: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [safety, setSafety] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typing = useRef<TypingController | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(new Map<string, string>());
  const seen = useRef(new Set<number>());
  const latestAt = useRef<string | null>(null);
  const live = useRef(false);

  // Ratchet state must advance in order: every decrypt goes through one serial queue.
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch((e) => console.error(e));
    return queue.current;
  }, []);

  const upsert = (m: Msg) =>
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.at.localeCompare(b.at));
      const next = prev.slice();
      next[i] = m;
      return next;
    });

  const ingest = useCallback(
    (row: MessageRow) =>
      enqueue(async () => {
        if (seen.current.has(row.id)) return;
        seen.current.add(row.id);
        if (!latestAt.current || row.created_at > latestAt.current) latestAt.current = row.created_at;
        const mine = row.sender_id === userId;
        const cached = await getCachedPlaintext(conversationId, String(row.id));
        if (cached !== null) return upsert({ id: row.id, mine, text: cached, at: row.created_at });

        const env = decodeEnvelope<Envelope>(row.ciphertext);
        if (!env || env.v !== 1) return upsert({ id: row.id, mine, text: null, at: row.created_at, failed: true });

        if (mine) {
          const text = pending.current.get(outgoingKey(env)) ?? null;
          if (text !== null) {
            pending.current.delete(outgoingKey(env));
            await cachePlaintext(conversationId, String(row.id), text);
          }
          return upsert({ id: row.id, mine, text, at: row.created_at });
        }

        try {
          const text = await decryptFromConversation(conversationId, userId, peerUserId, env);
          await cachePlaintext(conversationId, String(row.id), text);
          upsert({ id: row.id, mine, text, at: row.created_at });
        } catch (e) {
          console.warn('decrypt failed', e);
          upsert({ id: row.id, mine, text: null, at: row.created_at, failed: true });
        }
      }),
    [conversationId, userId, peerUserId, enqueue],
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chat/${conversationId}/messages`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (j: { messages?: MessageRow[]; error?: string }) => {
        if (cancelled) return;
        if (j.error) return setError(j.error);
        for (const row of j.messages ?? []) await ingest(row);
        peerIdentityKey(conversationId).then((k) => k && setSafety(fingerprint(fromB64(k))));
      })
      .catch(() => setError('Could not load messages'));

    const unsub = subscribeToMessages(conversationId, ingest, (isLive) => (live.current = isLive));
    typing.current = subscribeToTyping(conversationId, userId, (ids) => setPeerTyping(ids.includes(peerUserId)));

    // Fallback when the realtime socket is blocked (corporate proxies etc.): poll for rows newer than the last seen.
    const poll = setInterval(async () => {
      if (live.current || cancelled || document.hidden) return;
      const qs = latestAt.current ? `?after=${encodeURIComponent(latestAt.current)}` : '';
      const r = await fetch(`/api/chat/${conversationId}/messages${qs}`, { cache: 'no-store' }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { messages?: MessageRow[] };
      for (const row of j.messages ?? []) await ingest(row);
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      unsub();
      typing.current?.unsubscribe();
    };
  }, [conversationId, userId, peerUserId, ingest]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  const onType = (v: string) => {
    setInput(v);
    typing.current?.setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => typing.current?.setTyping(false), 1200);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    try {
      const env = await encryptForConversation(conversationId, peerUserId, text);
      pending.current.set(outgoingKey(env), text);
      const r = await fetch(`/api/chat/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciphertext: encodeEnvelope(env) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Send failed');
      await cachePlaintext(conversationId, String(j.id), text);
      pending.current.delete(outgoingKey(env));
      seen.current.add(j.id);
      upsert({ id: j.id, mine: true, text, at: j.created_at });
      setInput('');
      typing.current?.setTyping(false);
      if (!safety) peerIdentityKey(conversationId).then((k) => k && setSafety(fingerprint(fromB64(k))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-66px-var(--safe-bottom))] w-full max-w-[720px] flex-col overflow-hidden rail:h-dvh">
      <header className="relative flex items-center gap-2 border-b border-line-1 px-3 py-2 sm:px-4">
        <Link href="/app/chats" aria-label="Back" className="tap flex items-center justify-center text-[22px] text-fg-3 hover:text-fg">
          ‹
        </Link>
        <button
          type="button"
          onClick={() => setShowSafety((s) => !s)}
          aria-expanded={showSafety}
          className="tap min-w-0 flex-1 rounded-[12px] px-1 text-left hover:bg-ink-850"
        >
          <h1 className="truncate text-[15px] font-semibold">{peerHandle ? `@${peerHandle}` : 'Anonymous'}</h1>
          <p className="truncate text-[12px] text-fg-3">🔒 End-to-end encrypted{peerTyping ? ' · typing…' : ''}</p>
        </button>
        <VideoCall conversationId={conversationId} userId={userId} peerHandle={peerHandle} />
        <SafetyMenu peerUserId={peerUserId} peerHandle={peerHandle} conversationId={conversationId} />
      </header>

      {showSafety && (
        <div className="border-b border-line-1 bg-ink-900 px-4 py-3 text-[12px] text-fg-3">
          <p className="mb-1 font-semibold text-fg-2">Safety number</p>
          {safety ? (
            <p className="font-mono tracking-wider text-fg">{safety}</p>
          ) : (
            <p>Available after the first message is exchanged.</p>
          )}
          <p className="mt-1">Compare this with {peerHandle ? `@${peerHandle}` : 'them'} in person to verify nobody is in the middle.</p>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !error && (
          <p className="py-10 text-center text-[13px] text-fg-4">No messages yet. Say hi — it&apos;s encrypted before it leaves your device.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-card px-3.5 py-2 text-[14px] ${
                m.mine ? 'bg-green text-ink-950' : 'glass text-fg'
              } ${m.failed ? 'opacity-60' : ''}`}
            >
              <p className="whitespace-pre-wrap break-words">
                {m.text ?? (m.failed ? '🔒 Could not decrypt this message' : '🔒 Sent from another device')}
              </p>
              <p className={`mt-0.5 text-[10px] ${m.mine ? 'text-ink-950/60' : 'text-fg-4'}`}>
                {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 pb-1 text-[12px] text-danger">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-line-1 px-3 py-2.5 sm:px-4"
      >
        <input
          value={input}
          onChange={(e) => onType(e.target.value)}
          placeholder="Message"
          className="input h-11"
          disabled={sending}
          autoComplete="off"
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary h-11 shrink-0">
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
