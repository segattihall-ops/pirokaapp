'use client';

import { useEffect, useState } from 'react';

type Card = {
  status: string;
  hiv_month: number | null;
  sti_month: number | null;
  prevention: string[] | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: number | null) => (m === null || m < 0 || m > 11 ? '—' : MONTHS[m]);

/**
 * In a chat thread, shows the peer's sexual-health card when they have shared it with me
 * (GET /api/health/share?owner=<peerId> returns the verified card only if a share grant exists).
 */
export function HealthSharedBanner({
  peerUserId,
  peerHandle,
}: {
  peerUserId: string;
  peerHandle: string | null;
}) {
  const [card, setCard] = useState<Card | null>(null);

  useEffect(() => {
    let stop = false;
    fetch(`/api/health/share?owner=${encodeURIComponent(peerUserId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { card: null }))
      .then((j) => {
        if (!stop) setCard(j.card ?? null);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [peerUserId]);

  if (!card) return null;
  const name = peerHandle ? `@${peerHandle}` : 'This person';

  return (
    <div className="mx-4 mt-2 flex flex-col gap-1.5 rounded-card border border-sel-border bg-sel-fill px-3.5 py-2.5">
      <p className="text-[12px] font-semibold text-green">{name} shared their health card</p>
      <div className="flex gap-4 text-[13px] text-fg-2">
        <span>
          <span className="text-fg-4">Last HIV:</span> {monthLabel(card.hiv_month)}
        </span>
        <span>
          <span className="text-fg-4">Last STI:</span> {monthLabel(card.sti_month)}
        </span>
      </div>
      {card.prevention && card.prevention.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.prevention.map((p) => (
            <span key={p} className="chip">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
