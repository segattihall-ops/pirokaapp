'use client';

import { useEffect, useRef } from 'react';
import { getPosition, type Position } from '@/lib/geo/client';

/** Auto check-in radius; the server re-checks with PostGIS using the same figure. */
export const ARRIVE_RADIUS_M = 150;
const POLL_MS = 60_000;

type GoingPlace = { id: string; lat: number; lon: number };

export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371e3;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Tells the server "I arrived" for a place the member is going to. The fix is used once on the
 * server to verify proximity and is never stored. Resolves true when the check-in flipped to here.
 */
export async function reportArrival(placeId: string, fix: Position): Promise<boolean> {
  if (!fix.precise) return false;
  const r = await fetch('/api/places/arrive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId, lat: fix.lat, lng: fix.lon }),
  }).catch(() => null);
  if (!r?.ok) return false;
  const j = (await r.json().catch(() => ({}))) as { arrived?: boolean };
  return Boolean(j.arrived);
}

/**
 * Auto check-in on arrival. Give it the places the member is currently "going" to; every minute
 * (and when the tab becomes visible) it takes a fresh device fix and, when one of them is within
 * 150 m, asks the server to convert going → here. `onArrived` lets the caller refresh its list.
 * Usable from the Places screen now and from the map later.
 */
export function useAutoCheckin(going: GoingPlace[], onArrived?: (placeId: string) => void) {
  const busy = useRef(false);
  const ids = going.map((g) => g.id).join(',');

  useEffect(() => {
    if (!going.length) return;
    let alive = true;
    const tick = async () => {
      if (busy.current || document.visibilityState === 'hidden') return;
      busy.current = true;
      try {
        const fix = await getPosition({ fresh: true });
        if (!alive || !fix.precise) return;
        for (const g of going) {
          if (metres(fix, g) <= ARRIVE_RADIUS_M && (await reportArrival(g.id, fix))) {
            onArrived?.(g.id);
            break;
          }
        }
      } finally {
        busy.current = false;
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
}
