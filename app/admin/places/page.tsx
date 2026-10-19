'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Action,
  ActionRow,
  ConsoleHeader,
  DetailBlock,
  DetailHead,
  Facts,
  FilterChips,
  NoSelection,
  NoteBox,
  QueueLayout,
  type QueueRow,
} from '@/components/admin/console/ui';
import { useToast } from '@/components/admin/console/shell';
import { seedSites } from '@/lib/admin/ts-seed';

type Place = { id: string; name: string; kind: string; peakHint: string | null; verified: boolean };

export default function PlacesPage() {
  const toast = useToast();
  const [configured, setConfigured] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/places', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { places: Place[] };
      setConfigured(true);
      setPlaces(j.places);
    } else {
      // No backend → seeded queue (empty in production).
      setConfigured(false);
      setPlaces(
        seedSites().map((s) => ({
          id: s.id,
          name: s.name,
          kind: 'venue',
          peakHint: null,
          verified: s.verified,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // "Open" = still needs an admin to verify it.
  const isOpen = (p: Place) => !p.verified;

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return places
      .filter((p) => (filt === 'all' || isOpen(p)) && (!ql || JSON.stringify(p).toLowerCase().includes(ql)))
      .map((p) => ({
        id: p.id,
        dot: p.verified ? '#34d399' : '#fbbf24',
        title: p.name,
        meta: p.kind + (p.peakHint ? ` · ${p.peakHint}` : ''),
        tag: p.verified ? 'verified' : 'needs check',
        tagCol: p.verified ? '#34d399' : '#fbbf24',
      }));
  }, [places, filt, q]);

  const x = places.find((p) => p.id === sel && (filt === 'all' || isOpen(p))) ?? null;

  const act = (action: 'verify' | 'remove', msg: string) => async () => {
    if (!x) return;
    if (configured) {
      const r = await fetch('/api/admin/places', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: x.id, action }),
      }).catch(() => null);
      if (!r?.ok) {
        const j = r ? await r.json().catch(() => null) : null;
        return toast(j?.error ?? 'Could not update the listing.');
      }
      await load();
    } else {
      setPlaces((ps) =>
        action === 'remove'
          ? ps.filter((p) => p.id !== x.id)
          : ps.map((p) => (p.id === x.id ? { ...p, verified: true } : p)),
      );
    }
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Places"
        sub="Member-suggested venues"
        search
        q={q}
        onQ={setQ}
        demo={!configured}
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Needs check', n: places.filter(isOpen).length },
          { key: 'all', label: 'All', n: places.length },
        ]}
        active={filt}
        onPick={(k) => (setFilt(k as 'open' | 'all'), setSel(null))}
      />
      <QueueLayout
        rows={rows}
        selectedId={sel}
        onSelect={(id) => (setSel(id), setNote(''))}
        detail={
          !x ? (
            <NoSelection />
          ) : (
            <>
              <DetailHead title={x.name} id={x.id} />
              <Facts
                items={[
                  { k: 'Type', v: x.kind },
                  { k: 'Peak', v: x.peakHint || '—' },
                  { k: 'Listing', v: x.verified ? 'Verified' : 'Unverified' },
                ]}
              />
              <DetailBlock label="Checklist">
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  Confirm the venue exists and is LGBTQ+ friendly
                </span>
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  Confirm the type and typical peak times
                </span>
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  Remove duplicates and closed venues
                </span>
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Notes for the listing" />
              <ActionRow>
                <Action label="Mark verified" kind="pri" onClick={act('verify', `Verified ${x.name}.`)} />
                <Action label="Remove listing" kind="danger" onClick={act('remove', `Removed ${x.name}.`)} />
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
