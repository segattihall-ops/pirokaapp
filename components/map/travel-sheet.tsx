'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from './status-sheet';
import { addTripDays, tripNights, tripText } from '@/lib/map/pin-anatomy';

export type TravelView = { lat: number; lon: number; label: string };
type Hit = { name: string; lat: number; lon: number };

const today = () => new Date().toISOString().slice(0, 10);

const PinIcon = ({ className = 'text-fg-3' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 ${className}`}
    aria-hidden
  >
    <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.2" />
  </svg>
);

const Spinner = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" className="shrink-0 animate-spin text-fg-4" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

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
  const [picked, setPicked] = useState<Hit | null>(
    view ? { name: view.label, lat: view.lat, lon: view.lon } : null,
  );
  const [arriveOn, setArriveOn] = useState(today());
  const [nights, setNights] = useState(3);
  const [arrivalTime, setArrivalTime] = useState('');
  const [departOn, setDepartOn] = useState(() => addTripDays(today(), 3));
  const [departureTime, setDepartureTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return setHits([]);
    timer.current = setTimeout(async () => {
      setSearching(true);
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' }).catch(
        () => null,
      );
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
    const count = tripNights(arriveOn, departOn);
    if (count < 1 || count > 30) return setErr('Departure must be 1–30 nights after arrival');
    const r = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: picked.name, lat: picked.lat, lon: picked.lon, arriveOn, nights: count, departOn,
          ...(arrivalTime ? { arrivalTime } : {}),
          ...(departureTime ? { departureTime } : {}),
        }),
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
        {(hits.length > 0 || searching || (q.trim().length >= 2 && !err)) && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-[280px] divide-y divide-line-1 overflow-y-auto overflow-x-hidden rounded-input border border-line-2 bg-ink-900 shadow-sheet">
            {searching && hits.length === 0 && (
              <li className="flex items-center gap-2 px-3.5 py-3 text-[13px] text-fg-4">
                <Spinner />
                Searching…
              </li>
            )}
            {!searching && hits.length === 0 && q.trim().length >= 2 && (
              <li className="px-3.5 py-3 text-[13px] text-fg-4">No cities found.</li>
            )}
            {hits.map((h) => {
              const [city, ...rest] = h.name.split(', ');
              return (
                <li key={`${h.lat},${h.lon}`}>
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    className="tap flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-ink-850"
                  >
                    <PinIcon />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-medium text-fg">{city}</span>
                      {rest.length > 0 && (
                        <span className="truncate text-[12px] text-fg-3">{rest.join(', ')}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {picked && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-input border border-sel-border bg-sel-fill px-3.5 py-2.5 text-[14px]">
            <span className="flex min-w-0 items-center gap-2">
              <PinIcon className="text-green" />
              <span className="truncate">{picked.name}</span>
            </span>
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
            <p className="text-[12px] text-fg-3">
              Shows “visiting” on your profile and alerts favourites who are near that city.
            </p>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Arrive
                <input
                  type="date"
                  min={today()}
                  value={arriveOn}
                  onChange={(e) => { const value = e.target.value; setArriveOn(value); setDepartOn(addTripDays(value, nights)); }}
                  className="input h-11 normal-case tracking-normal"
                />
              </label>
              <label className="flex w-[110px] flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Arrival time
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="input h-11 normal-case tracking-normal"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-[145px] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Depart
                <input
                  type="date"
                  min={addTripDays(arriveOn, 1)}
                  value={departOn}
                  onChange={(e) => {
                    setDepartOn(e.target.value);
                    setNights(Math.max(1, tripNights(arriveOn, e.target.value)));
                  }}
                  className="input h-11 normal-case tracking-normal"
                />
              </label>
              <label className="flex w-[110px] flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">
                Departure time
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="input h-11 normal-case tracking-normal"
                />
              </label>
            </div>
            <p className="text-[12px] text-fg-3">
              {tripText({ arriveOn, nights, arrivalTime, departOn, departureTime })} · {tripNights(arriveOn, departOn)} nights
            </p>
            {err && (
              <p role="alert" className="text-[12px] text-danger">
                {err}
              </p>
            )}
            {msg && <p className="text-[12px] text-green">{msg}</p>}
            <button
              type="button"
              onClick={announce}
              disabled={busy}
              className="btn-primary h-11 bg-green hover:bg-green-hover"
            >
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
