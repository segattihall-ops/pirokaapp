'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Card = {
  id: string;
  handle: string | null;
  photo: string | null;
  verified: boolean;
  at: string;
};
type Data = { locked: boolean; likes: Card[]; views: Card[] };

const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : `${Math.floor(d / 7)}w`;
};

function Row({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return <p className="py-1 text-[13px] text-fg-4">No one yet — keep exploring.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {cards.map((c) => (
        <div key={c.id} className="flex w-[64px] flex-col items-center gap-1">
          <div className="relative h-16 w-16 overflow-hidden rounded-chip bg-ink-800">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[20px] font-bold text-fg-3">
                {(c.handle ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <span className="max-w-full truncate text-[11px] text-fg-3">
            {c.handle ? `@${c.handle}` : 'Someone'}
          </span>
          <span className="text-[10px] text-fg-4">{rel(c.at)}</span>
        </div>
      ))}
    </div>
  );
}

/** ME → premium "Who viewed or liked you". Reads /api/me/admirers; unlocked for all during launch. */
export function Admirers() {
  const [data, setData] = useState<Data | null | undefined>(undefined); // undefined = loading
  const [tab, setTab] = useState<'likes' | 'views'>('likes');

  useEffect(() => {
    fetch('/api/me/admirers', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => setData(null));
  }, []);

  if (data === undefined)
    return (
      <div className="glass rounded-card px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Who’s into you</p>
        <p className="py-1 text-[13px] text-fg-4">Loading…</p>
      </div>
    );
  if (data === null) return null;

  if (data.locked)
    return (
      <div className="glass flex flex-col gap-2 rounded-card px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Who’s into you</p>
        <p className="text-[13px] leading-[1.5] text-fg-4">
          See who liked and viewed your profile with Premium.
        </p>
        <Link href="/app/me/plan" className="btn-primary mt-1 h-10 bg-green text-[13px] hover:bg-green-hover">
          Unlock with Premium
        </Link>
      </div>
    );

  const cards = tab === 'likes' ? data.likes : data.views;

  return (
    <div className="glass flex flex-col gap-3 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Who’s into you</p>
        <div className="flex gap-1 rounded-input bg-ink-800 p-1">
          {(['likes', 'views'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`h-7 rounded-input px-3 text-[12px] font-semibold ${tab === k ? 'bg-ink-750 text-fg' : 'text-fg-3'}`}
            >
              {k === 'likes' ? `Liked (${data.likes.length})` : `Viewed (${data.views.length})`}
            </button>
          ))}
        </div>
      </div>
      <Row cards={cards} />
    </div>
  );
}
