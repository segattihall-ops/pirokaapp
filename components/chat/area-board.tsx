'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition, type Position } from '@/lib/geo/client';

type AreaMessage = {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
  distance_m: number;
  reply_count?: number;
};

type Reply = { id: number; author_id: string; content: string; created_at: string };

const BASE_POLL_MS = 30_000;
const MAX_POLL_MS = 5 * 60_000;
const MAX_FAILURES = 5; // after this many fetches in a row fail, stop polling until the user resumes

export function AreaBoard({ userId: _userId }: { userId: string }) {
  const [pos, setPos] = useState<Position | null>(null);
  const [messages, setMessages] = useState<AreaMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [paused, setPaused] = useState(false);
  const [openThread, setOpenThread] = useState<number | null>(null);
  const [replies, setReplies] = useState<Record<number, Reply[]>>({});
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  // Polling state lives in refs so a re-render never spawns a second loop (the old effect leaked one
  // interval per render, which flooded the network with "Failed to fetch").
  const posRef = useRef<Position | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failuresRef = useRef(0);
  const stoppedRef = useRef(false);

  const fetchOnce = useCallback(async (): Promise<boolean> => {
    const p = posRef.current;
    if (!p) return false;
    const r = await fetch(`/api/area/messages?lat=${p.lat}&lon=${p.lon}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`area messages ${r.status}`);
    const j = (await r.json()) as { messages: AreaMessage[] };
    setMessages(j.messages ?? []);
    return true;
  }, []);

  // Self-scheduling poll with exponential backoff; pauses after MAX_FAILURES so a flaky network or a
  // down endpoint never becomes a tight retry loop that drains battery and data.
  const schedule = useCallback(
    (delay: number) => {
      if (stoppedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await fetchOnce();
          failuresRef.current = 0;
          setErr('');
          schedule(BASE_POLL_MS);
        } catch {
          failuresRef.current += 1;
          if (failuresRef.current >= MAX_FAILURES) {
            setPaused(true);
            setErr('Could not reach the board. Updates paused.');
            return;
          }
          const backoff = Math.min(BASE_POLL_MS * 2 ** (failuresRef.current - 1), MAX_POLL_MS);
          schedule(backoff);
        }
      }, delay);
    },
    [fetchOnce],
  );

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;
    (async () => {
      const p = await getPosition({ ask: false }).catch(() => null);
      if (cancelled || !p) return;
      posRef.current = p;
      setPos(p);
      try {
        await fetchOnce();
        failuresRef.current = 0;
      } catch {
        failuresRef.current = 1;
      }
      if (!cancelled) schedule(BASE_POLL_MS);
    })();
    return () => {
      cancelled = true;
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchOnce, schedule]);

  const resume = () => {
    failuresRef.current = 0;
    stoppedRef.current = false;
    setPaused(false);
    setErr('');
    schedule(0);
  };

  const post = async () => {
    if (!pos || !text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/area/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.lat, lon: pos.lon, content: text.trim() }),
      });
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error ?? 'Failed to post');
        return;
      }
      setText('');
      // A successful post means the network is back: clear any pause and refresh now.
      resume();
    } catch {
      setErr('Failed to post');
    } finally {
      setBusy(false);
    }
  };

  const loadReplies = useCallback(async (id: number) => {
    const r = await fetch(`/api/area/messages?parentId=${id}`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return;
    const j = (await r.json().catch(() => ({}))) as { replies?: Reply[] };
    setReplies((prev) => ({ ...prev, [id]: j.replies ?? [] }));
  }, []);

  const toggleThread = (id: number) => {
    setReplyText('');
    if (openThread === id) {
      setOpenThread(null);
      return;
    }
    setOpenThread(id);
    if (!replies[id]) void loadReplies(id);
  };

  const postReply = async (id: number) => {
    if (!pos || !replyText.trim()) return;
    setReplyBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/area/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.lat, lon: pos.lon, content: replyText.trim(), parentId: id }),
      });
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error ?? 'Failed to reply');
        return;
      }
      setReplyText('');
      await loadReplies(id);
      // Bump the reply count locally so the thread control stays in sync without a full refetch.
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m)),
      );
    } catch {
      setErr('Failed to reply');
    } finally {
      setReplyBusy(false);
    }
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
          <span className="text-[12px] text-fg-3">{text.length}/500</span>
          <button type="submit" disabled={busy || !text.trim() || !pos} className="btn-primary">
            {busy ? '…' : 'Post'}
          </button>
        </div>
      </form>

      {err && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-danger">{err}</p>
          {paused && (
            <button
              type="button"
              onClick={resume}
              className="tap-link shrink-0 text-[12px] font-semibold text-green"
            >
              Resume
            </button>
          )}
        </div>
      )}

      {!pos ? (
        <p className="text-[13px] text-fg-3">Finding your location…</p>
      ) : messages.length === 0 ? (
        <p className="text-[13px] text-fg-3">No messages in this area yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((msg) => {
            const count = msg.reply_count ?? 0;
            const open = openThread === msg.id;
            const thread = replies[msg.id];
            return (
              <li key={msg.id} className="glass rounded-card border border-line-2 px-4 py-3">
                <p className="text-[13px] leading-relaxed text-fg">{msg.content}</p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-[11px] text-fg-4">
                    {msg.distance_m < 1000
                      ? `${msg.distance_m}m away`
                      : `${(msg.distance_m / 1000).toFixed(1)}km away`}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleThread(msg.id)}
                    aria-expanded={open}
                    className="tap-link text-[11px] font-semibold text-green"
                  >
                    {count > 0 ? `${count} ${count === 1 ? 'reply' : 'replies'}` : 'Reply'}
                  </button>
                </div>

                {open && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-line-1 pt-3">
                    {thread === undefined ? (
                      <p className="text-[12px] text-fg-3">Loading…</p>
                    ) : thread.length === 0 ? (
                      <p className="text-[12px] text-fg-3">No replies yet. Be the first.</p>
                    ) : (
                      thread.map((rep) => (
                        <p
                          key={rep.id}
                          className="rounded-input bg-ink-900 px-3 py-2 text-[13px] leading-relaxed text-fg-2"
                        >
                          {rep.content}
                        </p>
                      ))
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        postReply(msg.id);
                      }}
                      className="mt-1 flex items-end gap-2"
                    >
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply…"
                        maxLength={280}
                        rows={1}
                        className="input min-h-10 flex-1 resize-none py-2 text-[13px]"
                      />
                      <button
                        type="submit"
                        disabled={replyBusy || !replyText.trim() || !pos}
                        className="btn-secondary h-10 shrink-0 text-[13px]"
                      >
                        {replyBusy ? '…' : 'Send'}
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[12px] text-fg-4">Public messages within 5km. Share safely — block users anytime.</p>
    </section>
  );
}
