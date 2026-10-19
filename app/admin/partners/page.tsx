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

type EventRow = {
  id: string;
  title: string;
  about: string;
  venue: string;
  startsAt: string;
  capacity: number | null;
  status: 'pending' | 'rejected';
  note: string | null;
  createdAt: string;
};
type ClaimRow = {
  id: string;
  userId: string;
  listingName: string;
  address: string;
  kind: string;
  contact: string;
  status: 'pending' | 'approved' | 'rejected';
  placeId: string | null;
  createdAt: string;
};
type Filt = 'events' | 'claims' | 'done';

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Partner queue: events posted by venues/clinics (ambassador review) and "claim your listing" requests. */
export default function PartnersAdminPage() {
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [filt, setFilt] = useState<Filt>('events');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/partners', { cache: 'no-store' }).catch(() => null);
    if (!r) return setPending('Could not reach the server.');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setPending(j.error ?? 'Could not load the partner queue.');
    setPending(null);
    setEvents(j.events ?? []);
    setClaims(j.claims ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const openEvents = useMemo(() => events.filter((e) => e.status === 'pending'), [events]);
  const openClaims = useMemo(() => claims.filter((c) => c.status === 'pending'), [claims]);
  const done = useMemo(
    () => [
      ...events.filter((e) => e.status !== 'pending').map((e) => ({ kind: 'event' as const, e })),
      ...claims.filter((c) => c.status !== 'pending').map((c) => ({ kind: 'claim' as const, c })),
    ],
    [events, claims],
  );

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    const hit = (o: unknown) => !ql || JSON.stringify(o).toLowerCase().includes(ql);
    if (filt === 'events')
      return openEvents.filter(hit).map((e) => ({
        id: `e:${e.id}`,
        dot: '#fbbf24',
        title: e.title,
        meta: `${e.venue} · ${when(e.startsAt)}`,
        tag: 'in review',
        tagCol: '#fbbf24',
      }));
    if (filt === 'claims')
      return openClaims.filter(hit).map((c) => ({
        id: `c:${c.id}`,
        dot: '#fbbf24',
        title: c.listingName,
        meta: `${c.kind} · ${c.address}`,
        tag: 'claim',
        tagCol: '#fbbf24',
      }));
    return done.filter(hit).map((d) =>
      d.kind === 'event'
        ? { id: `e:${d.e.id}`, dot: '#666', title: d.e.title, meta: d.e.venue, tag: d.e.status, tagCol: '#666' }
        : { id: `c:${d.c.id}`, dot: d.c.status === 'approved' ? '#34d399' : '#666', title: d.c.listingName, meta: d.c.address, tag: d.c.status, tagCol: d.c.status === 'approved' ? '#34d399' : '#666' },
    );
  }, [filt, q, openEvents, openClaims, done]);

  const selEvent = sel?.startsWith('e:') ? events.find((e) => e.id === sel.slice(2)) ?? null : null;
  const selClaim = sel?.startsWith('c:') ? claims.find((c) => c.id === sel.slice(2)) ?? null : null;

  const act = (action: string, id: string, msg: string) => async () => {
    const r = await fetch('/api/admin/partners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, note: note || undefined }),
    }).catch(() => null);
    if (!r?.ok) {
      const j = r ? await r.json().catch(() => null) : null;
      return toast(j?.error ?? 'Could not update.');
    }
    await load();
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader title="Partners" sub="Venue & clinic events in review, listing claims" search q={q} onQ={setQ} demo={Boolean(pending)} />
      {pending && (
        <p role="alert" className="text-[12px] text-warning">
          {pending}
        </p>
      )}
      <FilterChips
        filters={[
          { key: 'events', label: 'Events in review', n: openEvents.length },
          { key: 'claims', label: 'Listing claims', n: openClaims.length },
          { key: 'done', label: 'Reviewed', n: done.length },
        ]}
        active={filt}
        onPick={(k) => (setFilt(k as Filt), setSel(null))}
      />
      <QueueLayout
        rows={rows}
        selectedId={sel}
        onSelect={(id) => (setSel(id), setNote(''))}
        detail={
          selEvent ? (
            <>
              <DetailHead title={selEvent.title} id={selEvent.id} />
              <Facts
                items={[
                  { k: 'Venue', v: selEvent.venue },
                  { k: 'Starts', v: when(selEvent.startsAt) },
                  { k: 'Capacity', v: selEvent.capacity ? String(selEvent.capacity) : 'open' },
                  { k: 'Status', v: selEvent.status },
                ]}
              />
              <DetailBlock label="About">
                <span className="text-[13px] leading-[1.5] text-fg-2">{selEvent.about || '—'}</span>
              </DetailBlock>
              <DetailBlock label="Checklist">
                <span className="text-[13px] leading-[1.5] text-fg-2">No drug or sex-for-pay listings</span>
                <span className="text-[13px] leading-[1.5] text-fg-2">18+ venue, date and time make sense</span>
                <span className="text-[13px] leading-[1.5] text-fg-2">Public page shows no attendee names</span>
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Note to the partner (shown with a rejection)" />
              <ActionRow>
                {selEvent.status === 'pending' && (
                  <Action label="Approve · goes live" kind="pri" onClick={act('approve_event', selEvent.id, `Approved ${selEvent.title}.`)} />
                )}
                {selEvent.status === 'pending' ? (
                  <Action label="Reject" kind="danger" onClick={act('reject_event', selEvent.id, `Rejected ${selEvent.title}.`)} />
                ) : (
                  <Action label="Approve after all" kind="default" onClick={act('approve_event', selEvent.id, `Approved ${selEvent.title}.`)} />
                )}
              </ActionRow>
            </>
          ) : selClaim ? (
            <>
              <DetailHead title={selClaim.listingName} id={selClaim.id} />
              <Facts
                items={[
                  { k: 'Type', v: selClaim.kind },
                  { k: 'Address', v: selClaim.address },
                  { k: 'Contact', v: selClaim.contact },
                  { k: 'Member', v: selClaim.userId.slice(0, 8) + '…' },
                  { k: 'Status', v: selClaim.status },
                ]}
              />
              <DetailBlock label="Checklist">
                <span className="text-[13px] leading-[1.5] text-fg-2">Call the venue or clinic on a published number and confirm the contact</span>
                <span className="text-[13px] leading-[1.5] text-fg-2">Match the address to the existing listing (or let a new one be created)</span>
                <span className="text-[13px] leading-[1.5] text-fg-2">Partners only ever see totals — never who checked in</span>
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Verification notes" />
              {selClaim.status === 'pending' && (
                <ActionRow>
                  <Action label="Approve & attach listing" kind="pri" onClick={act('approve_claim', selClaim.id, `Approved ${selClaim.listingName}.`)} />
                  <Action label="Reject" kind="danger" onClick={act('reject_claim', selClaim.id, `Rejected ${selClaim.listingName}.`)} />
                </ActionRow>
              )}
            </>
          ) : (
            <NoSelection />
          )
        }
      />
    </>
  );
}
