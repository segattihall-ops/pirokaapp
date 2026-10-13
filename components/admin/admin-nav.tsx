'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const ADMIN_TABS: { href: string; label: string }[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/revenue', label: 'Revenue' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/errors', label: 'Errors' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/flags', label: 'Flags' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/integrations', label: 'Integrations' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5 pb-1">
        {ADMIN_TABS.map((t) => {
          const active = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`chip whitespace-nowrap ${active ? 'chip-selected' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
