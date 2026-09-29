'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoTile } from '@/components/logo';

type Item = { href: string; label: string; icon: React.ReactNode };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ITEMS: Item[] = [
  {
    href: '/app/map',
    label: 'MAP',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
    ),
  },
  {
    href: '/app/pulse',
    label: 'PULSE',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
      </svg>
    ),
  },
  {
    href: '/app/chats',
    label: 'CHATS',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4z" />
      </svg>
    ),
  },
  {
    href: '/app/places',
    label: 'PLACES',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6" />
      </svg>
    ),
  },
  {
    href: '/app/me',
    label: 'ME',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
];

export function useActive(href: string) {
  const path = usePathname();
  return path === href || path.startsWith(href + '/');
}

function NavLink({ item, variant, badge }: { item: Item; variant: 'rail' | 'tab'; badge?: number }) {
  const active = useActive(item.href);
  const base =
    variant === 'rail'
      ? 'relative flex h-[58px] w-[60px] flex-col items-center justify-center gap-1.5 rounded-[14px]'
      : 'relative flex h-full flex-1 flex-col items-center justify-center gap-1';
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`${base} tap transition-colors ${active ? 'text-green' : 'text-fg-3 hover:text-fg'} ${
        active && variant === 'rail' ? 'bg-sel-fill' : ''
      }`}
    >
      {active && variant === 'rail' && (
        <span aria-hidden className="absolute -left-[10px] top-3 h-[34px] w-[3px] rounded-full bg-green" />
      )}
      <span className="relative">
        {item.icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-2 min-w-[18px] rounded-chip bg-green px-1 text-center text-[10px] font-bold leading-[18px] text-ink-950">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-nav">{item.label}</span>
    </Link>
  );
}

/** 80px left rail — desktop (≥820px). */
export function Rail({ unread = 0 }: { unread?: number }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-rail flex-col items-center border-r border-line-1 bg-rail pb-4 pt-4 rail:flex"
    >
      <Link href="/app/map" className="mb-5 rounded-logo" aria-label="πroka home">
        <LogoTile size={44} />
      </Link>
      <div className="flex flex-col gap-1">
        {ITEMS.map((it) => (
          <NavLink key={it.href} item={it} variant="rail" badge={it.href === '/app/chats' ? unread : 0} />
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center gap-2">
        {/* Quick-exit shield — wired in Phase 7. */}
        <button
          type="button"
          aria-label="Quick exit"
          className="tap flex h-11 w-11 items-center justify-center rounded-[14px] border border-line-2 bg-ink-850 text-fg-3 hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}>
            <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

/** 66px bottom tab bar — mobile (<820px). Respects the home-indicator safe area. */
export function TabBar({ unread = 0 }: { unread?: number }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(66px+var(--safe-bottom))] border-t border-line-1 bg-ink-900/95 pb-[var(--safe-bottom)] backdrop-blur-md rail:hidden"
    >
      {ITEMS.map((it) => (
        <NavLink key={it.href} item={it} variant="tab" badge={it.href === '/app/chats' ? unread : 0} />
      ))}
    </nav>
  );
}
