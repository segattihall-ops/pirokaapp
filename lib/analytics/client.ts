'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { EventName } from './events';

/**
 * Browser-side analytics. Events go to /api/analytics/track, which attaches the session user and
 * writes them server-side. Uses sendBeacon so navigation never waits for the request.
 */

const ANON_KEY = 'piroka_anon_id';

export function anonId(): string {
  try {
    let v = localStorage.getItem(ANON_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, v);
    }
    return v;
  } catch {
    return 'no-storage';
  }
}

export function track(event: EventName, props: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({ event, props, path: window.location.pathname, anonId: anonId() });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {}
  fetch('/api/analytics/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(
    () => {},
  );
}

/** Mount once (Providers) to record a page_view on every client-side navigation. */
export function usePageviews(): void {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    // Private paths carry ids; only the first two segments are reported.
    const coarse = pathname.split('/').slice(0, 3).join('/') || '/';
    track('page_view', { route: coarse });
  }, [pathname]);
}
