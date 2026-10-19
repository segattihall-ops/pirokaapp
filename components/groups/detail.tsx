'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Member = { user_id: string; joined_at: string; users: { id: string; handle: string | null } | null };
type Group = {
  id: string;
  name: string;
  description: string | null;
  location_name: string;
  members_count: number;
  created_at: string;
  group_members: Member[];
};
type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string | null;
  sender: { handle: string | null } | null;
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

/**
 * Group detail + members-only chat. Reads /api/groups/[id] for info/members, derives membership from
 * the signed-in member's id, and (when a member) polls /api/groups/[id]/messages for the group chat.
 */
export function GroupDetail({ groupId, meId }: { groupId: string; meId: string }) {
  const [group, setGroup] = useState<Group | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);

  const isMember = Boolean(group && group.group_members.some((m) => m.user_id === meId));

  const loadGroup = useCallback(async () => {
    try {
      const r = await fetch(`/api/groups/${groupId}`, { cache: 'no-store' });
      if (!r.ok) return setGroup(null);
      const j = await r.json();
      setGroup(j.group ?? null);
    } catch {
      setGroup(null);
    }
  }, [groupId]);
  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  // Poll the chat while a member. First call seeds the list; later calls fetch only newer messages.
  useEffect(() => {
    if (!isMember) return;
    let stop = false;
    const tick = async () => {
      try {
        const q = lastAtRef.current ? `?after=${encodeURIComponent(lastAtRef.current)}` : '';
        const r = await fetch(`/api/groups/${groupId}/messages${q}`, { cache: 'no-store' });
        if (!r.ok || stop) return;
        const j = (await r.json()) as { messages: Message[] };
        if (j.messages.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = lastAtRef.current
            ? [...prev, ...j.messages.filter((m) => !seen.has(m.id))]
            : j.messages;
          lastAtRef.current = merged[merged.length - 1]?.created_at ?? lastAtRef.current;
          return merged;
        });
      } catch {
        /* transient; next tick retries */
      }
    };
    void tick();
    const iv = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [isMember, groupId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const join = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch(`/api/groups/${groupId}/join`, { method: 'POST' }).catch(() => null);
    if (!r || (!r.ok && r.status !== 409)) setErr('Could not join this group.');
    await loadGroup();
    setBusy(false);
  };

  const leave = async () => {
    if (!confirm('Leave this group?')) return;
    setBusy(true);
    setErr('');
    const r = await fetch(`/api/groups/${groupId}/leave`, { method: 'DELETE' }).catch(() => null);
    if (!r || !r.ok) {
      setErr('Could not leave this group.');
      setBusy(false);
      return;
    }
    setMessages([]);
    lastAtRef.current = null;
    await loadGroup();
    setBusy(false);
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const j = (await r.json()) as { message: Message };
        setDraft('');
        setMessages((prev) => {
          if (prev.some((m) => m.id === j.message.id)) return prev;
          lastAtRef.current = j.message.created_at;
          return [...prev, j.message];
        });
      }
    } finally {
      setSending(false);
    }
  };

  if (group === undefined) return <p className="py-6 text-[14px] text-fg-4">Loading…</p>;
  if (group === null)
    return (
      <div className="glass flex flex-col gap-3 rounded-card px-4 py-5">
        <p className="text-[14px] text-fg-2">This group doesn’t exist or was removed.</p>
        <Link href="/app/places" className="tap-link text-[13px] font-semibold text-green">
          ‹ Back to Places
        </Link>
      </div>
    );

  return (
    <>
      <Link href="/app/places" className="tap-link text-[13px] font-medium text-fg-3">
        ‹ Places
      </Link>

      <div className="glass flex flex-col gap-2 rounded-card px-4 py-4">
        <h1 className="text-h2">{group.name}</h1>
        <p className="text-[13px] text-fg-3">
          {group.location_name} · {group.members_count} {group.members_count === 1 ? 'member' : 'members'}
        </p>
        {group.description && <p className="text-[14px] leading-[1.5] text-fg-2">{group.description}</p>}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {group.group_members.slice(0, 12).map((m) => (
            <span key={m.user_id} className="chip">
              {m.users?.handle ? `@${m.users.handle}` : 'member'}
            </span>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          {isMember ? (
            <button type="button" onClick={leave} disabled={busy} className="btn-secondary h-10 text-[13px]">
              {busy ? '…' : 'Leave group'}
            </button>
          ) : (
            <button
              type="button"
              onClick={join}
              disabled={busy}
              className="btn-primary h-10 bg-green text-[13px] hover:bg-green-hover"
            >
              {busy ? '…' : 'Join group'}
            </button>
          )}
        </div>
        {err && (
          <p role="alert" className="text-[12px] text-danger">
            {err}
          </p>
        )}
      </div>

      {isMember ? (
        <div className="glass flex flex-col overflow-hidden rounded-card">
          <div className="border-b border-line-1 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Group chat</p>
          </div>
          <div ref={scrollRef} className="flex h-[360px] flex-col gap-2.5 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="m-auto text-[13px] text-fg-4">Say hello — start the conversation.</p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === meId;
                return (
                  <div
                    key={m.id}
                    className={`flex max-w-[82%] flex-col gap-0.5 ${mine ? 'items-end self-end' : 'items-start self-start'}`}
                  >
                    {!mine && (
                      <span className="px-1 text-[11px] text-fg-4">
                        {m.sender?.handle ? `@${m.sender.handle}` : 'member'}
                      </span>
                    )}
                    <span
                      className={`rounded-card px-3.5 py-2.5 text-[14px] leading-[1.5] ${
                        mine
                          ? 'rounded-br-input bg-green font-medium text-ink-950'
                          : 'rounded-bl-input bg-ink-800 text-fg'
                      }`}
                    >
                      {m.body}
                    </span>
                    <span className="px-1 text-[10px] text-fg-4">{timeLabel(m.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-2 border-t border-line-1 px-4 pb-4 pt-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              maxLength={2000}
              placeholder="Message the group…"
              aria-label="Message the group"
              className="input h-[46px] min-w-0 flex-1 font-normal text-fg"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              className="tap h-[46px] rounded-btn bg-fg px-[18px] text-[14px] font-semibold text-ink-950 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-card px-4 py-5 text-[13px] text-fg-4">
          Join this group to open its chat.
        </div>
      )}
    </>
  );
}
