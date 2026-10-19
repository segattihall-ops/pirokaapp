'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { distanceLabel, getPosition, timeLeft, type Position } from '@/lib/geo/client';
import type { Place } from '@/app/api/places/route';
import { Sheet } from '@/components/map/status-sheet';
import EventCard from '@/components/events/event-card';
import EventSheet from '@/components/events/event-sheet';
import { TestingDirectory } from '@/components/health/testing-directory';
import { GroupsList } from '@/components/groups/list';
import { CreateGroupForm } from '@/components/groups/create';
import type { Event } from '@/lib/events/types';
import { useAutoCheckin } from '@/lib/places/auto-checkin';
import { PlaceDetailSheet } from './place-detail-sheet';
import { Flame, Glyph, KIND_LABEL, PlaceBadge, crowdWord, etaLabel } from './place-glyphs';

const KINDS = Object.keys(KIND_LABEL);
type Tab = 'places' | 'events' | 'groups' | 'testing';
const TABS: [Tab, string][] = [
  ['places', 'Places'],
  ['events', 'Events'],
  ['groups', 'Groups'],
  ['testing', 'Testing'],
];
const ETAS: { min: 15 | 30 | 60; label: string }[] = [
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 hour' },
];

export function PlacesScreen() {
  const [pos, setPos] = useState<Position | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [suggest, setSuggest] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [goingFor, setGoingFor] = useState<Place | null>(null);
  const [detail, setDetail] = useState<Place | null>(null);
  const [toast, setToast] = useState('');
  const params = useSearchParams();
  const initialTab = ((): Tab => {
    const t = params.get('tab');
    return t === 'events' || t === 'testing' || t === 'groups' ? t : 'places';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto check-in: places I'm "going" to flip to "here" once the device is within 150 m.
  const going = useMemo(
    () => (places ?? []).filter((p) => p.my?.kind === 'going').map((p) => ({ id: p.id, lat: p.lat, lon: p.lon })),
    [places],
  );
  useAutoCheckin(going, (id) => {
    const name = places?.find((p) => p.id === id)?.name ?? 'the venue';
    setToast(`You arrived at ${name} — checked in.`);
    if (pos) load(pos);
  });

  const checkin = async (place: Place, kind: 'here' | 'going' | null, etaMin?: 15 | 30 | 60) => {
    setBusy(place.id);
    setErr('');
    const r = kind
      ? await fetch('/api/places/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: place.id, kind, etaMin }),
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
      <div className="flex items-end justify-between gap-3 pr-14 rail:pr-16">
        <div>
          <span className="eyebrow">Live places</span>
          <h1 className="text-h2 sm:text-h1">What&apos;s happening</h1>
        </div>
        {tab === 'places' && (
          <button type="button" onClick={() => setSuggest(true)} className="btn-secondary h-10 shrink-0 text-[13px]">
            + Suggest a place
          </button>
        )}
        {tab === 'groups' && (
          <button
            type="button"
            onClick={() => setNewGroup((v) => !v)}
            className="btn-secondary h-10 shrink-0 text-[13px]"
            aria-expanded={newGroup}
          >
            {newGroup ? 'Cancel' : '+ New group'}
          </button>
        )}
        {tab === 'events' && (
          <button
            type="button"
            onClick={() => setShowEvent(true)}
            className="btn-secondary h-10 shrink-0 text-[13px]"
          >
            + Create event
          </button>
        )}
      </div>
      <div className="flex gap-1.5" role="tablist" aria-label="Places sections">
        {TABS.map(([value, label]) => (
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
          Check in to show you&apos;re there (4 h) or say you&apos;re going with an arrival time — you&apos;re checked in
          automatically when you get there. Only counts are public, never who.
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
      {toast && (
        <p role="status" className="rounded-input border border-sel-border bg-sel-fill px-3.5 py-2.5 text-[13px] text-fg">
          {toast}
        </p>
      )}

      {tab === 'places' && (
        <div className="flex flex-col gap-1.5">
          {places === null ? (
            <p className="text-[13px] text-fg-3">Finding places near you…</p>
          ) : places.length === 0 ? (
            <p className="text-[13px] text-fg-3">No places within 10 miles yet. Be the first to suggest one.</p>
          ) : (
            places.map((p) => {
              const mine = p.my?.kind ?? null;
              return (
                <div key={p.id} className="glass flex flex-col gap-3 rounded-card px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setDetail(p)}
                    className="tap -mx-1 flex items-start gap-3 rounded-input px-1 text-left"
                    aria-label={`${p.name} details`}
                  >
                    <PlaceBadge kind={p.kind} here={p.here} going={p.going} popping={p.popping} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                        <span className="truncate">{p.name}</span>
                        {p.verified ? (
                          <span className="text-[11px] text-green" aria-label="Verified">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-[0.1em] text-fg-4">suggested</span>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-fg-3">
                        {KIND_LABEL[p.kind] ?? p.kind} · {distanceLabel(p.distanceM)}
                        {p.address ? ` · ${p.address}` : ''}
                        {p.peakHint ? ` · ${p.peakHint}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-[12px] leading-tight">
                      <p className="flex items-center justify-end gap-1 font-semibold text-fg">
                        {p.popping && (
                          <span className="text-danger" aria-label="It's popping">
                            <Flame />
                          </span>
                        )}
                        {crowdWord(p.here)}
                      </p>
                      <p className={p.going ? 'text-fg-2' : 'text-fg-4'}>{p.going} on the way</p>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => checkin(p, mine === 'here' ? null : 'here')}
                      className={`chip h-11 flex-1 justify-center ${mine === 'here' ? 'chip-selected' : ''}`}
                    >
                      {mine === 'here' ? `Here · ${timeLeft(p.my!.expiresAt)}` : "I'm here"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => (mine === 'going' ? checkin(p, null) : setGoingFor(p))}
                      className={`chip h-11 flex-1 justify-center ${mine === 'going' ? 'chip-selected' : ''}`}
                    >
                      {mine === 'going' ? `Going · ${etaLabel(p.my!.etaAt)}` : "I'm going"}
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
            <p className="text-[13px] text-fg-3">No events nearby yet. Events people create around you show up here.</p>
          ) : (
            events.map((e) => <EventCard key={e.id} event={e} onRsvp={() => pos && loadEvents(pos)} />)
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-3">Communities near you. Join one to open its group chat.</p>
          {!pos ? (
            <p className="text-[13px] text-fg-3">Finding your location…</p>
          ) : (
            <>
              {newGroup && (
                <div className="glass rounded-card px-4 py-3.5">
                  <CreateGroupForm
                    initialLat={pos.lat}
                    initialLng={pos.lon}
                    initialLocationName="Near me"
                    onSuccess={() => setNewGroup(false)}
                  />
                </div>
              )}
              <GroupsList lat={pos.lat} lng={pos.lon} />
            </>
          )}
        </div>
      )}

      {tab === 'testing' && <TestingDirectory />}

      {goingFor && (
        <Sheet title={`Going to ${goingFor.name}`} onClose={() => setGoingFor(null)}>
          <p className="text-[13px] text-fg-3">
            When will you get there? You&apos;re checked in automatically on arrival. Two no-shows pause
            &ldquo;I&apos;m going&rdquo; for 5 days.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ETAS.map((e) => (
              <button
                key={e.min}
                type="button"
                disabled={busy === goingFor.id}
                onClick={async () => {
                  const p = goingFor;
                  setGoingFor(null);
                  await checkin(p, 'going', e.min);
                }}
                className="chip h-12 justify-center text-[14px]"
              >
                {e.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {detail && (
        <PlaceDetailSheet
          placeId={detail.id}
          distanceM={detail.distanceM}
          busy={busy === detail.id}
          onClose={() => setDetail(null)}
          onCheckin={() => checkin(detail, 'here')}
          onLeave={() => checkin(detail, null)}
          onGoing={() => {
            setDetail(null);
            setGoingFor(detail);
          }}
          onChanged={() => pos && load(pos)}
        />
      )}

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

      {showEvent && pos && (
        <EventSheet
          lat={pos.lat}
          lon={pos.lon}
          locationName=""
          onClose={() => setShowEvent(false)}
          onCreated={() => loadEvents(pos)}
        />
      )}
    </section>
  );
}

function SuggestSheet({ pos, onClose, onCreated }: { pos: Position; onClose: () => void; onCreated: () => void }) {
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
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input h-12" maxLength={80} />
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`chip gap-1.5 ${kind === k ? 'chip-selected' : ''}`}
          >
            <Glyph kind={k} size={14} /> {KIND_LABEL[k]}
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
