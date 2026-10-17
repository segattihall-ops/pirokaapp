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
import { useRole, useToast } from '@/components/admin/console/shell';
import { seedAmbassadors } from '@/lib/admin/ts-seed';

export default function AmbassadorsPage() {
  const { role } = useRole();
  const toast = useToast();
  const admin = role === 'Admin';
  const [ambs, setAmbs] = useState(() => seedAmbassadors());
  const [filt, setFilt] = useState<'open' | 'active' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return ambs
      .filter(
        (b) => (filt === 'all' || b.status === filt) && (!ql || JSON.stringify(b).toLowerCase().includes(ql)),
      )
      .map((b) => ({
        id: b.id,
        dot: b.status === 'active' ? '#34d399' : '#f5f5f5',
        title: `${b.user} · ${b.city}`,
        meta:
          b.status === 'active'
            ? `${b.actions} actions · ${b.agree}% agree with moderators`
            : `${b.hours} / week`,
        tag: b.status,
        tagCol: b.status === 'open' ? '#34d399' : '#666',
      }));
  }, [ambs, filt, q]);

  const x = ambs.find((b) => b.id === sel && (filt === 'all' || b.status === filt)) ?? null;

  const resolve = (status: string, msg: string) => {
    if (!x) return;
    setAmbs((bs) => bs.map((b) => (b.id === x.id ? { ...b, status } : b)));
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Ambassadors"
        sub="Applications and active ambassadors by city"
        search
        q={q}
        onQ={setQ}
        demo
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Applications', n: ambs.filter((b) => b.status === 'open').length },
          { key: 'active', label: 'Active', n: ambs.filter((b) => b.status === 'active').length },
          { key: 'all', label: 'All', n: ambs.length },
        ]}
        active={filt}
        onPick={(k) => (setFilt(k as 'open' | 'active' | 'all'), setSel(null))}
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
              <DetailHead title={x.user} id={x.id} />
              <Facts
                items={[
                  { k: 'City', v: x.city },
                  { k: 'Time', v: `${x.hours} / week` },
                  { k: 'Status', v: x.status },
                  { k: 'Agreement with mods', v: x.status === 'active' ? `${x.agree}%` : '—' },
                ]}
              />
              <DetailBlock label={x.status === 'active' ? 'Powers' : 'Application'}>
                {x.status === 'active' ? (
                  <>
                    <span className="text-[13px] leading-[1.5] text-fg-2">
                      Hide content pending review · Verify events and places · Welcome newcomers
                    </span>
                    <span className="text-[13px] leading-[1.5] text-fg-2">
                      Cannot ban, see reports about themselves, or see private data.
                    </span>
                  </>
                ) : (
                  <span className="text-[13px] leading-[1.5] text-fg-2">{x.why}</span>
                )}
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Note" />
              <ActionRow>
                {x.status === 'open' ? (
                  <>
                    <Action
                      label="Approve"
                      kind="pri"
                      onClick={() => resolve('active', `${x.user} is now an ambassador.`)}
                    />
                    <Action
                      label="Decline"
                      kind="danger"
                      onClick={() => resolve('declined', `Declined ${x.user}.`)}
                    />
                  </>
                ) : (
                  <Action
                    label="Remove ambassador"
                    kind="danger"
                    disabled={!admin}
                    title={admin ? '' : 'Admins only'}
                    onClick={() => resolve('removed', `Removed ambassador ${x.user}.`)}
                  />
                )}
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
