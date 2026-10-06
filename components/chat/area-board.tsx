'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition, type Position } from '@/lib/geo/client';
import { Avatar } from '@/components/people/user-row';

type AreaMessage = {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
  distance_m: number;
};

export function AreaBoard({ userId }: { userId: string }) {
  const [pos, setPos] = useState<Position | null>(null);
  const [messages, setMessages] = useState<AreaMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const refreshRef = useRef<(() => void) | null>(null);

  const locate = useCallback(async () => {
    const p = await getPosition({ ask: false });
    setPos(p);
    return p;
  }, []);

  const refresh = useCallback(
    async (p: Position | null) => {
      const current = p ?? pos;
      if (!current) return;
      const r = await fetch(`/api/area/messages?lat=${current.lat}&lon=${current.lon}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as { messages: AreaMessage[] };
      setMessages(j.messages);
    },
    [pos],
  );

  useEffect(() => {
    (async () => {
      const p = await locate();
      await refresh(p);
      refreshRef.current = () => refresh(p);
      const interval = setInterval(() => refresh(p), 30_000);
      return () => clearInterval(interval);
    })();
  }, [locate, refresh]);

  const post = async () => {
    if (!pos || !text.trim()) return;
    setBusy(true);
    setErr('');
    const r = await fetch('/api/area/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: pos.lat, lon: pos.lon, content: text.trim() }),
    });
    setBusy(false);
    if (!r.ok) return setErr('Failed to post');
    setText('');
    refreshRef.current?.();
  };

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <span className="eyebrow">Chats</span>
          <h1 className="text-h2 sm:text-h1">Area Board</h1>
        </div>
        <a href="/app/chats" className="tap text-[13px] font-medium text-green hover:text-green/80">
          Messages
        </a>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          post();
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share something with your area…"
          maxLength={500}
          className="input min-h-20 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-fg-3">
            {text.length}/500
          </span>
          <button
            type="submit"
            disabled={busy || !text.trim() || !pos}
            className="btn-primary"
          >
            {busy ? '…' : 'Post'}
          </button>
        </div>
      </form>

      {err && <p className="text-[12px] text-danger">{err}</p>}

      {!pos ? (
        <p className="text-[13px] text-fg-3">Finding your location…</p>
      ) : messages.length === 0 ? (
        <p className="text-[13px] text-fg-3">No messages in this area yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className="glass rounded-card border border-line-2 px-4 py-3"
            >
              <p className="text-[13px] leading-relaxed text-fg">{msg.content}</p>
              <p className="mt-2 text-[11px] text-fg-4">
                {msg.distance_m < 1000 ? `${msg.distance_m}m away` : `${(msg.distance_m / 1000).toFixed(1)}km away`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-fg-4">
        Public messages within 5km. Share safely — block users anytime.
      </p>
    </section>
  );
}
