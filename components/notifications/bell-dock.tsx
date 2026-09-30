'use client';

import { usePathname } from 'next/navigation';
import { NotificationBell } from './bell';

/**
 * Fixed top-right bell for the app tabs. Pages that draw their own top overlay (the map) leave room for it;
 * an open conversation has a full header of its own, so the dock steps aside there.
 */
export function BellDock() {
  const path = usePathname();
  if (/^\/app\/chats\/[^/]+/.test(path ?? '')) return null;
  return (
    <div className="pointer-events-none fixed right-3.5 top-[calc(14px+var(--safe-top))] z-30 rail:right-5 rail:top-5">
      <NotificationBell className="pointer-events-auto" />
    </div>
  );
}
