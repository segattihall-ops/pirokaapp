'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from './status-sheet';

export type TravelView = { lat: number; lon: number; label: string };
type Hit = { name: string; lat: number; lon: number };

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Travel mode: look at another city without moving your own pin, and optionally announce the trip
 * so favourites there get an arrival alert. Only the city is stored.
 */
export function TravelSheet({
  view,
  onView,
  onClose,
}: {
  view: TravelView | null;
  onView: (v: TravelView | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Hit | null>(view ? { name: view.label, lat: view.lat, lon: view.lon } : null);
  const [arriveOn, setArriveOn] = useState(today());
  const [nights, setNights] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setHits([]);
    timer.current = setTimeout(async () => {
      setSearching(true);
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' }).catch(() => null);
      setSearching(false);
      if (!r?.ok) return setErr('City search is unavailable right now');
      setErr('');
      setHits(((await r.json()) as { hits: Hit[] }).hits);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const pick = (h: Hit) => {
    setPicked(h);
    setHits([]);
    setQ('');
    onView({ lat: h.lat, lon: h.lon, label: h.name });
  };

  const announce = async () => {
    if (!picked) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const r = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: picked.name, lat: picked.lat, lon: picked.lon, arriveOn, nights }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'Could not save the trip');
    setMsg(`Trip saved. Favourites near ${picked.name.split(',')[0]} will hear you are coming.`);
  };

  return (
    <Sheet title="Travel" onClose={onClose}>
      <p className="-mt-2 text-[13px] text-fg-3">Browse another city. Your own pin stays where you are.</p>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city"
          aria-label="Search a city"
          className="input h-12"
          autoComplete="off"
          autoFocus
        />
        {(hits.length > 0 || searching) && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-input border border-line-2 bg-ink-900 shadow-sheet">
            {searching && hits.length === 0 && <li className="px-3.5 py-2.5 text-[13px] text-fg-4">Searching…</li>}
            {hits.map((h) => (
              <li key={`${h.lat},${h.lon}`}>
                <button type="button" onClick={() => pick(h)} className="tap block w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-ink-850">
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {picked && (
        <>
          <div className="flex items-center justify-between rounded-input border border-sel-border bg-sel-fill px-3.5 py-2.5 text-[14px]">
            <span className="truncate">📍 {picked.name}</span>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                onView(null);
              }}
              className="tap-link text-[12px] font-semibold text-fg-3 hover:text-fg"
            >
              Back to me
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-card border border-line-1 p-3.5">
            <p className="text-[13px] font-semibold">Announce this trip</p>
            <p className="text-[12px] text-fg-3">Shows “visiting” on your profile and alerts favourites who are near that city.</p>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Arrive
                <input type="date" min={today()} value={arriveOn} onChange={(e) => setArriveOn(e.target.value)} className="input h-11 normal-case tracking-normal" />
              </label>
              <label className="flex w-[110px] flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Nights
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={nights}
                  onChange={(e) => setNights(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                  className="input h-11 normal-case tracking-normal"
                />
              </label>
            </div>
            {err && (
              <p role="alert" className="text-[12px] text-danger">
                {err}
              </p>
            )}
            {msg && <p className="text-[12px] text-green">{msg}</p>}
            <button type="button" onClick={announce} disabled={busy} className="btn-primary h-11 bg-green hover:bg-green-hover">
              {busy ? '…' : 'Announce trip'}
            </button>
          </div>
        </>
      )}
      {!picked && err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
    </Sheet>
  );
}
