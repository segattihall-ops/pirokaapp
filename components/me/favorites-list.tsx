'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProfileSheet } from '@/components/map/profile-sheet';
import { UserRow, type CardUser } from '@/components/people/user-row';

type Fav = CardUser & { alerts: boolean; since: string };

/** People I starred. Alerts = push me when they go live or land in my city. */
export function FavoritesList() {
  const [favs, setFavs] = useState<Fav[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/favorites', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((j) => setFavs(j.favorites ?? []))
      .catch(() => setFavs([]));
  }, []);
  useEffect(load, [load]);

  const setAlerts = async (f: Fav, alerts: boolean) => {
    setBusy(f.id);
    setFavs((prev) => prev?.map((x) => (x.id === f.id ? { ...x, alerts } : x)) ?? null);
    const r = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: f.id, alerts }),
    }).catch(() => null);
    if (!r?.ok) setFavs((prev) => prev?.map((x) => (x.id === f.id ? { ...x, alerts: !alerts } : x)) ?? null);
    setBusy(null);
  };

  const remove = async (f: Fav) => {
    setBusy(f.id);
    await fetch('/api/favorites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: f.id }),
    }).catch(() => {});
    setBusy(null);
    load();
  };

  return (
    <div id="favorites" className="glass flex flex-col rounded-card px-4 py-2">
      <p className="py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Favourites{favs?.length ? ` · ${favs.length}` : ''}</p>
      {!favs ? (
        <p className="py-2 text-[13px] text-fg-4">Loading…</p>
      ) : favs.length === 0 ? (
        <p className="py-2 text-[13px] text-fg-4">Tap ☆ on a profile. They are not told, and you get a nudge when they go live.</p>
      ) : (
        favs.map((f) => (
          <UserRow key={f.id} user={f} onOpen={() => setOpen(f.id)}>
            <button
              type="button"
              role="switch"
              aria-checked={f.alerts}
              aria-label={`Alerts for ${f.handle ? '@' + f.handle : 'this person'}`}
              disabled={busy === f.id}
              onClick={() => setAlerts(f, !f.alerts)}
              className={`tap-hit h-7 w-12 shrink-0 rounded-chip border transition-colors disabled:opacity-40 ${
                f.alerts ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'
              }`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${f.alerts ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
            </button>
            <button type="button" aria-label="Remove favourite" disabled={busy === f.id} onClick={() => remove(f)} className="tap-hit px-2 text-[18px] text-fg-4 hover:text-fg">
              ×
            </button>
          </UserRow>
        ))
      )}
      {open && <ProfileSheet userId={open} distanceM={null} onClose={() => setOpen(null)} />}
    </div>
  );
}
