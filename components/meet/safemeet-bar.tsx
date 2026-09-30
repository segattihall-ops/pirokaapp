'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicMeet } from '@/lib/meet/server';
import { SafeMeetCard } from './safemeet-card';
import { SafeMeetSheet } from './safemeet-sheet';

/**
 * Sits under the chat header. Shows a "Start SafeMeet" row when nothing is running, the live card
 * for the owner, or a one-line notice for the other person. Polls every 30 s so both sides stay current.
 */
export function SafeMeetBar({ conversationId, peerHandle }: { conversationId: string; peerHandle: string | null }) {
  const [meet, setMeet] = useState<PublicMeet | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/meet?conversation=${conversationId}`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return setMeet(null);
    const j = (await r.json()) as { active: PublicMeet | null };
    setMeet(j.active);
  }, [conversationId]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (meet === undefined) return null;

  return (
    <div className="border-b border-line-1 px-3 py-2 sm:px-4">
      {meet ? (
        <SafeMeetCard meet={meet} onChange={(m) => setMeet(m)} compact />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="tap-link flex w-full items-center gap-2 text-[13px] text-fg-3 hover:text-fg">
          <span>🛡️</span>
          <span>
            Meeting up? <span className="font-semibold text-green">Start SafeMeet</span> — timed check-ins and a link for someone you trust.
          </span>
        </button>
      )}
      {open && (
        <SafeMeetSheet
          conversationId={conversationId}
          peerHandle={peerHandle}
          onStarted={(m) => {
            setMeet(m);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
