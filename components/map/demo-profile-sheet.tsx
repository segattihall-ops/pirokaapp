'use client';

import type { NearbyPerson } from '@/app/api/nearby/route';
import { distanceLabel, intentMeta, timeLeft } from '@/lib/geo/client';
import { POSITION_LABEL } from './filters';
import { flagUrl } from './place-pins';
import { Sheet } from './status-sheet';

/** Profile view for a simulated (demo) person — there is no backend row to fetch, so it renders the demo data. */
export function DemoProfileSheet({ person, onClose }: { person: NearbyPerson; onClose: () => void }) {
  const meta = intentMeta(person.intent);
  const a = person.attrs;
  const tags = [
    ...a.gender,
    ...a.position.map((p) => POSITION_LABEL[p] ?? p),
    ...a.orientation,
    ...a.communities,
    ...a.ethnicity,
  ].filter(Boolean);
  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start gap-4">
        <span className="flex h-[150px] w-[112px] shrink-0 items-center justify-center rounded-card bg-ink-800 text-[32px] font-bold text-fg-3">
          {(person.handle || '?').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em]">
              {person.handle ? `@${person.handle}` : 'Anonymous'}
            </h2>
            {person.verified && <span className="text-[12px] font-bold text-green">✓</span>}
            {a.origin && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flagUrl(a.origin)} alt="" className="h-[14px] w-[20px] rounded-[3px] object-cover" />
            )}
          </div>
          {meta && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-chip border border-line-2 px-2.5 py-1 text-[12px] font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
              {person.travelMi ? ` · ${person.travelMi} mi` : ''}
              <span className="font-normal text-fg-3"> · {timeLeft(person.intentEndsAt)}</span>
            </p>
          )}
          <p className="mt-1 text-[12px] text-fg-3">{distanceLabel(person.distanceM)}</p>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="rounded-chip border border-line-2 px-2.5 py-1 text-[12px] text-fg-2"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="rounded-input border border-line-2 bg-white/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-fg-3">
        Demo profile. Connect Supabase and add members to message, share albums and start Meet Mode for real.
      </p>
      <p className="text-center text-[11px] text-fg-4">Messages are end-to-end encrypted.</p>
    </Sheet>
  );
}
