'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Conversation = {
  id: string;
  mutual: boolean;
  peer: { id: string; handle: string | null };
  lastAt: string | null;
};

function ago(iso: string | null) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function ConversationList() {
  const router = useRouter();
  const [state, setState] = useState<{ configured: boolean; conversations: Conversation[] } | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/chat/conversations', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false, conversations: [] }));
  }, []);

  const start = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    setErr('');
    const r = await fetch('/api/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'Could not start chat');
    router.push(`/app/chats/${j.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        className="flex gap-2"
      >
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Start a chat by @handle"
          className="input h-11"
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !handle.trim()} className="btn-primary h-11 shrink-0">
          {busy ? '…' : 'Chat'}
        </button>
      </form>
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}

      {state === null ? (
        <p className="text-[13px] text-fg-3">Loading…</p>
      ) : !state.configured ? (
        <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
          Chat needs Supabase. Add the keys and run the migrations.
        </p>
      ) : state.conversations.length === 0 ? (
        <p className="text-[13px] text-fg-3">No conversations yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {state.conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/chats/${c.id}`}
                className="glass flex items-center justify-between rounded-card px-4 py-3.5 text-[14px]"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-[12px] font-bold text-fg-2">
                    {(c.peer.handle ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  {c.peer.handle ? `@${c.peer.handle}` : 'Anonymous'}
                  {c.mutual && <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-green">mutual</span>}
                </span>
                <span className="text-[12px] text-fg-4">{ago(c.lastAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-fg-4">🔒 Messages are end-to-end encrypted on this device. Sign out clears the keys.</p>
    </div>
  );
}
