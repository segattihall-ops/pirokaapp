'use client';

import { useCallback, useEffect, useState } from 'react';
import { distanceLabel, getPosition, timeLeft, type Position } from '@/lib/geo/client';
import type { Place } from '@/app/api/places/route';
import { Sheet } from '@/components/map/status-sheet';
import EventCard from '@/components/events/event-card';
import { TestingDirectory } from '@/components/health/testing-directory';
import type { Event } from '@/lib/events/types';

const KINDS: { value: string; label: string; glyph: string }[] = [
  { value: 'bar', label: 'Bar', glyph: '🍸' },
  { value: 'club', label: 'Club', glyph: '🪩' },
  { value: 'cafe', label: 'Café', glyph: '☕' },
  { value: 'restaurant', label: 'Restaurant', glyph: '🍽' },
  { value: 'gym', label: 'Gym', glyph: '🏋️' },
  { value: 'park', label: 'Park', glyph: '🌳' },
  { value: 'beach', label: 'Beach', glyph: '🏖' },
  { value: 'sauna', label: 'Sauna', glyph: '♨️' },
  { value: 'shop', label: 'Shop', glyph: '🛍' },
  { value: 'venue', label: 'Venue', glyph: '🎤' },
  { value: 'other', label: 'Other', glyph: '📍' },
];
const glyph = (kind: string) => KINDS.find((k) => k.value === kind)?.glyph ?? '📍';

export function PlacesScreen() {
  const [pos, setPos] = useState<Position | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [suggest, setSuggest] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'places' | 'events' | 'testing'>('places');
  const [events, setEvents] = useState<Event[] | null>(null);

  const loadEvents = useCallback(async (p: Position) => {
    const r = await fetch(`/api/events?lat=${p.lat}&lon=${p.lon}&radius=25`, { cache: 'no-store' }).catch(
      () => null,
    );
    if (!r?.ok) return setEvents([]);
    setEvents(((await r.json()) as { events: Event[] }).events ?? []);
  }, []);

  useEffect(() => {
    if (tab === 'events' && pos && events === null) loadEvents(pos);
  }, [tab, pos, events, loadEvents]);

  const load = useCallback(async (p: Position) => {
    const r = await fetch(`/api/places?lat=${p.lat}&lon=${p.lon}&radius=15000`, { cache: 'no-store' }).catch(
      () => null,
    );
    if (!r?.ok) return setPlaces([]);
    const j = await r.json();
    setConfigured(j.configured);
    setPlaces(j.places);
  }, []);

  useEffect(() => {
    getPosition().then((p) => {
      setPos(p);
      load(p);
    });
  }, [load]);

  const checkin = async (place: Place, kind: 'here' | 'going' | null) => {
    setBusy(place.id);
    setErr('');
    const r = kind
      ? await fetch('/api/places/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: place.id, kind }),
        })
      : await fetch('/api/places/checkin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: place.id }),
        });
    setBusy(null);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not check in');
    if (pos) load(pos);
  };

  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Live places</span>
          <h1 className="text-h2 sm:text-h1">What&apos;s happening</h1>
        </div>
        {tab === 'places' && (
          <button
            type="button"
            onClick={() => setSuggest(true)}
            className="btn-secondary h-10 shrink-0 text-[13px]"
          >
            + Suggest a place
          </button>
        )}
      </div>
      <div className="flex gap-1.5" role="tablist" aria-label="Places sections">
        {(
          [
            ['places', 'Places'],
            ['events', 'Events'],
            ['testing', 'Testing'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`chip ${tab === value ? 'chip-selected' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'places' && (
        <p className="text-[13px] text-fg-3">
          Check in to a venue to show you&apos;re there (4 h) or going later (24 h). Only counts are public,
          never who.
        </p>
      )}
      {!configured && (
        <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
          Places need Supabase — add the keys and run the migrations.
        </p>
      )}
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}

      {tab === 'places' && (
        <div className="flex flex-col gap-1.5">
          {places === null ? (
            <p className="text-[13px] text-fg-3">Finding places near you…</p>
          ) : places.length === 0 ? (
            <p className="text-[13px] text-fg-3">
              No places within 10 miles yet. Be the first to suggest one.
            </p>
          ) : (
            places.map((p) => {
              const mine = p.my?.kind ?? null;
              return (
                <div key={p.id} className="glass flex flex-col gap-3 rounded-card px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ink-800 text-[18px]">
                      {glyph(p.kind)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                        {p.name}
                        {p.verified ? (
                          <span className="text-[11px] text-green">✓</span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-[0.1em] text-fg-4">suggested</span>
                        )}
                      </p>
                      <p className="text-[12px] text-fg-3">
                        {distanceLabel(p.distanceM)}
                        {p.address ? ` · ${p.address}` : ''}
                        {p.peakHint ? ` · ${p.peakHint}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-[12px] leading-tight">
                      <p className={p.here ? 'font-semibold text-green' : 'text-fg-4'}>{p.here} here</p>
                      <p className={p.going ? 'text-warning' : 'text-fg-4'}>{p.going} going</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => checkin(p, mine === 'here' ? null : 'here')}
                      className={`chip flex-1 justify-center ${mine === 'here' ? 'chip-selected' : ''}`}
                    >
                      {mine === 'here' ? `Here · ${timeLeft(p.my!.expiresAt)}` : "I'm here"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => checkin(p, mine === 'going' ? null : 'going')}
                      className={`chip flex-1 justify-center ${mine === 'going' ? 'chip-selected' : ''}`}
                    >
                      {mine === 'going' ? `Going · ${timeLeft(p.my!.expiresAt)}` : 'Going later'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="flex flex-col gap-3">
          {events === null ? (
            <p className="text-[13px] text-fg-3">Finding events near you…</p>
          ) : events.length === 0 ? (
            <p className="text-[13px] text-fg-3">
              No events nearby yet. Events people create around you show up here.
            </p>
          ) : (
            events.map((e) => <EventCard key={e.id} event={e} onRsvp={() => pos && loadEvents(pos)} />)
          )}
        </div>
      )}

      {tab === 'testing' && <TestingDirectory />}

      {suggest && pos && (
        <SuggestSheet
          pos={pos}
          onClose={() => setSuggest(false)}
          onCreated={() => {
            setSuggest(false);
            load(pos);
          }}
        />
      )}
    </section>
  );
}

function SuggestSheet({
  pos,
  onClose,
  onCreated,
}: {
  pos: Position;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('bar');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind, address: address || undefined, lat: pos.lat, lng: pos.lon }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not add place');
    onCreated();
  };

  return (
    <Sheet title="Suggest a place" onClose={onClose}>
      <p className="text-[13px] text-fg-3">
        It&apos;s added at your current position
        {pos.precise ? '' : ' (approximate — turn on location for accuracy)'} and marked as suggested until
        verified.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="input h-12"
        maxLength={80}
      />
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`chip ${kind === k.value ? 'chip-selected' : ''}`}
          >
            {k.glyph} {k.label}
          </button>
        ))}
      </div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional)"
        className="input h-12"
        maxLength={160}
      />
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || name.trim().length < 2}
        className="btn-primary h-12 bg-green hover:bg-green-hover"
      >
        {busy ? '…' : 'Add place'}
      </button>
    </Sheet>
  );
}
