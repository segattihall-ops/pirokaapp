'use client';

import Link from 'next/link';
import { intentMeta } from '@/lib/geo/client';
import { fmtDur } from '@/lib/intent';
import { Sheet } from './status-sheet';
import type { MyStatus } from './status-sheet';

/** Tapping your own pin opens this card — intent, time left, and the shortcuts the prototype lists. */
export function MyCardSheet({
  handle,
  photo,
  status,
  now,
  onEditIntent,
  onClose,
}: {
  handle: string | null;
  photo: string | null;
  status: MyStatus;
  now: number;
  onEditIntent: () => void;
  onClose: () => void;
}) {
  const meta = intentMeta(status?.intent);
  const left = status ? fmtDur((new Date(status.ends_at).getTime() - now) / 60_000) : '';
  return (
    <Sheet title="Your profile" onClose={onClose}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-green bg-ink-800 bg-cover bg-center text-[22px] font-bold"
          style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
        >
          {photo ? '' : 'π'}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[18px] font-semibold">{handle ? `@${handle}` : 'Anonymous'}</span>
          <span className="text-[12px] font-semibold text-green">
            {meta ? `${meta.label} · ${left} left` : 'You'}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEditIntent}
          className="btn-primary h-11 bg-green hover:bg-green-hover"
        >
          {status ? 'Edit intent' : 'Set intent'}
        </button>
        <Link href="/app/me/edit" className="btn-secondary h-11">
          Edit profile
        </Link>
        <Link href="/help/safety" className="btn-secondary h-11">
          Safety Center
        </Link>
        <Link href="/app/me#billing" className="btn-secondary h-11">
          Plan &amp; billing
        </Link>
      </div>
      <Link href="/app/me" className="tap-link text-center text-[13px] font-medium text-green">
        All settings in ME →
      </Link>
    </Sheet>
  );
}
