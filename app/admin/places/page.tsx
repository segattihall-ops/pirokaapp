'use client';

import { useMemo, useState } from 'react';
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

export default function PlacesPage() {
  const toast = useToast();
  const [sites, setSites] = useState(() => seedSites());
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return sites
      .filter(
        (p) =>
          (filt === 'all' || p.status === 'open') && (!ql || JSON.stringify(p).toLowerCase().includes(ql)),
      )
      .map((p) => ({
        id: p.id,
        dot: p.verified ? '#34d399' : '#fbbf24',
        title: p.name,
        meta: `Dallas, TX ${p.zip}`,
        tag: p.verified ? 'verified' : 'needs check',
        tagCol: p.verified ? '#34d399' : '#fbbf24',
      }));
  }, [sites, filt, q]);

  const x = sites.find((p) => p.id === sel && (filt === 'all' || p.status === 'open')) ?? null;

  const update = (patch: Partial<(typeof sites)[number]>, msg: string) => {
    if (!x) return;
    setSites((ss) => ss.map((p) => (p.id === x.id ? { ...p, ...patch } : p)));
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Places &amp; testing"
        sub="Venue and clinic listings"
        search
        q={q}
        onQ={setQ}
        demo
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Open', n: sites.filter((p) => p.status === 'open').length },
          { key: 'all', label: 'All', n: sites.length },
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
                  { k: 'ZIP', v: x.zip },
                  { k: 'Listing', v: x.verified ? 'Verified' : 'Unverified' },
                ]}
              />
              <DetailBlock label="Checklist">
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  Confirm hours and services by phone
                </span>
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  Confirm free / sliding-scale pricing
                </span>
                <span className="text-[13px] leading-[1.5] text-fg-2">Confirm walk-in vs appointment</span>
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Notes for the listing" />
              <ActionRow>
                <Action
                  label="Mark verified"
                  kind="pri"
                  onClick={() =>
                    update({ verified: true, status: 'verified' }, `Verified listing ${x.name}.`)
                  }
                />
                <Action
                  label="Hide listing"
                  kind="danger"
                  onClick={() => update({ status: 'hidden' }, `Hid listing ${x.name}.`)}
                />
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
