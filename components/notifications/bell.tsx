'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Sheet } from '@/components/map/status-sheet';
import { Avatar, type CardUser } from '@/components/people/user-row';

type Notice = {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  user: CardUser | null;
  read: boolean;
  at: string;
};

const POLL_MS = 30_000;
const ICON: Record<string, string> = {
  message: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  call: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  album_request: 'M4 4h16v16H4zM8 15l3-4 3 3 2-2 3 4',
  album_grant: 'M4 4h16v16H4zM8 15l3-4 3 3 2-2 3 4',
  album: 'M4 4h16v16H4zM8 15l3-4 3 3 2-2 3 4',
  status: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  arrival: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  favorite: 'M12 21s-8-4.6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 5.4-8 10-8 10z',
  match: 'M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z',
  safety: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z',
};

function NoticeGlyph({ kind }: { kind: string }) {
  const color = kind === 'safety' ? '#fbbf24' : ['status', 'match'].includes(kind) ? '#34d399' : '#f5f5f5';
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON[kind] ?? ICON.message} />
    </svg>
  );
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Floating bell with the unread count. Opens a sheet with the latest notifications;
 * opening marks them read. Polls the count every 30 s while the tab is visible.
 */
export function NotificationBell({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[] | null>(null);

  const poll = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const r = await fetch('/api/notifications?count=1', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setUnread(((await r.json()) as { unread: number }).unread ?? 0);
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [poll]);

  const show = async () => {
    setOpen(true);
    setItems(null);
    const r = await fetch('/api/notifications', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return setItems([]);
    const j = (await r.json()) as { notifications: Notice[] };
    setItems(j.notifications);
    if (j.notifications.some((n) => !n.read)) {
      fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
        .then(() => setUnread(0))
        .catch(() => {});
    }
  };

  const go = (n: Notice) => {
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  const clear = async () => {
    await fetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
    setItems([]);
    setUnread(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={`tap relative flex h-11 w-11 items-center justify-center rounded-[14px] border border-line-2 bg-ink-850/90 text-fg-2 backdrop-blur-md hover:text-fg ${className}`}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-chip bg-green px-1 text-center text-[10px] font-bold leading-[18px] text-ink-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <Sheet title="Notifications" onClose={() => setOpen(false)}>
          {!items ? (
            <p className="py-6 text-center text-[13px] text-fg-3">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-fg-3">Nothing yet. Favourites going live, album requests and calls land here.</p>
          ) : (
            <ul className="-mx-1 flex flex-col">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className={`tap-hit flex w-full items-center gap-3 rounded-[12px] px-1 py-2.5 text-left hover:bg-ink-850 ${n.read ? '' : 'bg-sel-fill/40'}`}
                  >
                    {n.user ? (
                      <Avatar user={n.user} size={40} />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ink-800 text-[18px]"><NoticeGlyph kind={n.kind} /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {n.user ? <span className="mr-1 inline-flex align-middle"><NoticeGlyph kind={n.kind} /></span> : null}
                        {n.title}
                      </span>
                      {n.body && <span className="block truncate text-[12px] text-fg-3">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-fg-4">{ago(n.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items && items.length > 0 && (
            <button type="button" onClick={clear} className="btn-ghost h-10 text-[13px]">
              Clear all
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
