'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Announcement = { id: string; title: string; body: string; url: string | null };
const KEY = 'piroka_dismissed_announcements';

function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** One banner at a time (newest first); dismissals persist per device. */
export function AnnouncementBanner() {
  const [item, setItem] = useState<Announcement | null>(null);

  useEffect(() => {
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((j: { announcements: Announcement[] }) => {
        const gone = new Set(dismissed());
        setItem(j.announcements.find((a) => !gone.has(a.id)) ?? null);
      })
      .catch(() => {});
  }, []);

  if (!item) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...dismissed(), item.id].slice(-50)));
    } catch {}
    setItem(null);
  };

  return (
    <div role="status" className="fixed inset-x-3 top-[calc(10px+var(--safe-top))] z-40 mx-auto max-w-[560px] rail:left-[calc(var(--rail-w,80px)+12px)]">
      <div className="glass flex items-start gap-3 rounded-card border border-[rgba(52,211,153,0.35)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{item.title}</p>
          <p className="text-[12px] text-fg-3">{item.body}</p>
          {item.url && (
            <Link href={item.url} onClick={close} className="tap-link mt-1 inline-block text-[12px] font-semibold text-green">
              Learn more ›
            </Link>
          )}
        </div>
        <button type="button" onClick={close} aria-label="Dismiss announcement" className="tap-hit -mr-1 -mt-1 h-8 w-8 rounded-full text-fg-3 hover:text-fg">
          ×
        </button>
      </div>
    </div>
  );
}
