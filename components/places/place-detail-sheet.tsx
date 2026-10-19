'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/map/status-sheet';
import type { PlaceDetail } from '@/app/api/places/[id]/route';
import type { PlaceChatMessage } from '@/app/api/places/[id]/chat/route';
import { distanceLabel, timeLeft } from '@/lib/geo/client';
import { Flame, KIND_LABEL, PlaceBadge, crowdWord, etaLabel, fmtHour } from './place-glyphs';

const CHAT_POLL_MS = 30_000;

export function PlaceDetailSheet({
  placeId,
  distanceM,
  onClose,
  onCheckin,
  onGoing,
  onLeave,
  onChanged,
  busy,
}: {
  placeId: string;
  distanceM: number | null;
  onClose: () => void;
  onCheckin: () => Promise<void>;
  onGoing: () => void;
  onLeave: () => Promise<void>;
  onChanged?: () => void;
  busy: boolean;
}) {
  const [d, setD] = useState<PlaceDetail | null>(null);
  const [err, setErr] = useState('');
  const [msgs, setMsgs] = useState<PlaceChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/places/${placeId}`, { cache: 'no-store' }).catch(() => null);
    if (!r) return setErr('Could not load this place');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? 'Could not load this place');
    setD(j as PlaceDetail);
  }, [placeId]);

  const loadChat = useCallback(async () => {
    const r = await fetch(`/api/places/${placeId}/chat`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return setMsgs((m) => m ?? []);
    const j = (await r.json()) as { messages: PlaceChatMessage[] };
    setMsgs(j.messages);
  }, [placeId]);

  useEffect(() => {
    load();
    loadChat();
    const t = setInterval(loadChat, CHAT_POLL_MS);
    return () => clearInterval(t);
  }, [load, loadChat]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs?.length]);

  const vote = async () => {
    if (!d) return;
    const r = await fetch(`/api/places/${placeId}/vote`, { method: d.myVote ? 'DELETE' : 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? 'Could not vote');
    setD({ ...d, votes: j.votes, popping: j.popping, myVote: j.mine });
    onChanged?.();
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setChatErr('');
    const r = await fetch(`/api/places/${placeId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setChatErr(j.error ?? 'Could not send');
    setText('');
    loadChat();
  };

  const refreshAfter = async (fn: () => Promise<void>) => {
    await fn();
    load();
  };

  const mine = d?.my?.kind ?? null;

  return (
    <Sheet onClose={onClose}>
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      {!d ? (
        <p className="text-[13px] text-fg-3">Loading…</p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <PlaceBadge kind={d.kind} here={d.here} going={d.onTheWay} popping={d.popping} size={52} />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-1.5 text-[20px] font-semibold tracking-[-0.02em]">
                <span className="truncate">{d.name}</span>
                {d.verified ? (
                  <span className="text-[12px] font-bold text-green" aria-label="Verified">
                    ✓
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.1em] text-fg-4">suggested</span>
                )}
              </h2>
              <p className="text-[12px] text-fg-3">
                {KIND_LABEL[d.kind] ?? d.kind}
                {distanceM != null ? ` · ${distanceLabel(distanceM)}` : ''}
                {d.address ? ` · ${d.address}` : ''}
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-fg-2">
                {crowdWord(d.here)}
                {d.popping && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-danger">
                    <Flame /> popping
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['Here now', d.here],
                ['On the way', d.onTheWay],
                ['Visitors', d.visitors],
                ['Peak', d.peakHour != null ? fmtHour(d.peakHour) : d.peakHint ?? '—'],
              ] as [string, number | string][]
            ).map(([label, v]) => (
              <div key={label} className="glass flex flex-col items-center rounded-input px-1 py-2 text-center">
                <span className="text-[16px] font-semibold tabular-nums">{v}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-fg-4">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => (mine === 'here' ? refreshAfter(onLeave) : refreshAfter(onCheckin))}
              className={`chip h-11 flex-1 justify-center ${mine === 'here' ? 'chip-selected' : ''}`}
            >
              {mine === 'here' ? `Here · ${timeLeft(d.my!.expiresAt)}` : 'Check in'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (mine === 'going' ? refreshAfter(onLeave) : onGoing())}
              className={`chip h-11 flex-1 justify-center ${mine === 'going' ? 'chip-selected' : ''}`}
            >
              {mine === 'going' ? `Going · ${etaLabel(d.my!.etaAt)}` : "I'm going"}
            </button>
          </div>
          {mine === 'here' && (
            <button
              type="button"
              onClick={vote}
              aria-pressed={d.myVote}
              className={`tap flex h-11 items-center justify-center gap-2 rounded-btn border text-[13px] font-semibold ${
                d.myVote ? 'border-danger/60 bg-danger/10 text-danger' : 'border-line-3 text-fg'
              }`}
            >
              <Flame size={14} />
              {d.myVote ? 'You said it’s popping' : 'It’s popping!'}
              <span className="text-fg-3">
                · {d.votes}/5
              </span>
            </button>
          )}

          <section className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Place chat · last 12 h</p>
            <div ref={listRef} className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-input bg-ink-950/60 p-2">
              {msgs === null ? (
                <p className="text-[12px] text-fg-4">Loading…</p>
              ) : msgs.length === 0 ? (
                <p className="text-[12px] text-fg-4">Nobody has said anything here yet.</p>
              ) : (
                msgs.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                    <span
                      className={`max-w-[85%] rounded-[14px] px-3 py-1.5 text-[13px] leading-snug ${
                        m.mine ? 'bg-green text-ink-950' : 'bg-ink-800 text-fg'
                      }`}
                    >
                      {m.body}
                    </span>
                    <span className="mt-0.5 text-[10px] text-fg-4">
                      {m.mine ? 'You' : m.name} ·{' '}
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                placeholder="Say something to everyone here"
                aria-label="Message"
                className="input h-11 flex-1"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label="Send"
                className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-green text-ink-950 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
            {chatErr && (
              <p role="alert" className="text-[12px] text-danger">
                {chatErr}
              </p>
            )}
            <p className="text-[11px] text-fg-4">Moderated, not encrypted. Only counts are public, never who.</p>
          </section>
        </>
      )}
    </Sheet>
  );
}
