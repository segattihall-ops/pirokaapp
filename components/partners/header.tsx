import Link from 'next/link';
import { LogoTile } from '@/components/logo';
import type { Listing } from '@/lib/partners/shared';

/**
 * "π · πroka for Partners · Venues, clinics and organizers" with the listing picker when the
 * member manages more than one listing (prototype header).
 */
export function PartnerHeader({
  listings,
  selected,
  onPick,
}: {
  listings: Pick<Listing, 'key' | 'name'>[];
  selected?: string;
  onPick?: (key: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line-1 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-3 px-4 py-3">
        <Link href="/partners" className="flex min-w-0 items-center gap-2.5 rounded-logo">
          <LogoTile size={36} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold leading-tight">πroka for Partners</span>
            <span className="truncate text-[12px] text-fg-3">Venues, clinics and organizers</span>
          </span>
        </Link>
        {listings.length > 1 && onPick && (
          <select
            value={selected}
            onChange={(e) => onPick(e.target.value)}
            aria-label="Your listing"
            className="input h-11 w-auto max-w-[46vw] shrink-0 py-0 text-[14px]"
          >
            {listings.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </header>
  );
}
