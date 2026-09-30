'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Trip = { id: string; city: string; arrive_on: string; nights: number };

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Trips I announced from the map's travel mode. */
export function TripsList() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/trips', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((j) => setTrips(j.trips ?? []))
      .catch(() => setTrips([]));
  }, []);
  useEffect(load, [load]);

  const remove = async (id: string) => {
    setBusy(id);
    await fetch('/api/trips', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    setBusy(null);
    load();
  };

  return (
    <div id="trips" className="glass flex flex-col rounded-card px-4 py-2">
      <div className="flex items-center justify-between py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Trips</p>
        <Link href="/app/map?travel=1" className="tap-link text-[12px] font-semibold text-green">
          Plan a trip
        </Link>
      </div>
      {!trips ? (
        <p className="py-2 text-[13px] text-fg-4">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="py-2 text-[13px] text-fg-4">Announce a trip and favourites in that city hear you are coming.</p>
      ) : (
        trips.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-t border-line-1 py-2.5">
            <span className="text-[18px]">✈️</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{t.city}</span>
              <span className="block text-[12px] text-fg-3">
                {fmt(t.arrive_on)} · {t.nights} night{t.nights === 1 ? '' : 's'}
              </span>
            </span>
            <button type="button" disabled={busy === t.id} onClick={() => remove(t.id)} className="btn-ghost h-9 px-3 text-[13px]">
              Cancel
            </button>
          </div>
        ))
      )}
    </div>
  );
}
