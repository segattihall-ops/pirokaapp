'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicMeet } from '@/lib/meet/server';
import { SafeMeetCard } from './safemeet-card';

/** On Me: the running SafeMeet, if any, so check-ins are one tap away from anywhere. */
export function SafeMeetMe() {
  const [meet, setMeet] = useState<PublicMeet | null>(null);
  useEffect(() => {
    fetch('/api/meet', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { active: null }))
      .then((j) => setMeet(j.active?.mine ? j.active : null))
      .catch(() => {});
  }, []);
  if (!meet) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <SafeMeetCard meet={meet} onChange={setMeet} />
      {meet.conversationId && (
        <Link href={`/app/chats/${meet.conversationId}`} className="tap-link self-end text-[12px] font-semibold text-green">
          Open the chat ›
        </Link>
      )}
    </div>
  );
}
