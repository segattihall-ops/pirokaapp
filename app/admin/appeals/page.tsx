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
  Warn,
  type QueueRow,
} from '@/components/admin/console/ui';
import { useRole, useToast } from '@/components/admin/console/shell';
import { agoLabel, seedAppeals } from '@/lib/admin/ts-seed';

export default function AppealsPage() {
  const { role } = useRole();
  const toast = useToast();
  const me = role === 'Admin' ? 'Kai (Admin)' : 'Rafa (T&S)';
  const [appeals, setAppeals] = useState(() => seedAppeals());
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return appeals
      .filter(
        (a) =>
          (filt === 'all' || a.status === 'open') && (!ql || JSON.stringify(a).toLowerCase().includes(ql)),
      )
      .map((a) => ({
        id: a.id,
        dot: '#f5f5f5',
        title: `${a.user} · ${a.action}`,
        meta: `${a.rule} · ${agoLabel(a.age)}`,
        tag: a.status,
        tagCol: a.status === 'open' ? '#34d399' : '#666',
      }));
  }, [appeals, filt, q]);

  const x = appeals.find((a) => a.id === sel && (filt === 'all' || a.status === 'open')) ?? null;
  const same = x?.by === me;

  const resolve = (status: string, msg: string) => {
    if (!x) return;
    setAppeals((as) => as.map((a) => (a.id === x.id ? { ...a, status } : a)));
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Appeals"
        sub="Reviewed by a different moderator than the original action"
        search
        q={q}
        onQ={setQ}
        demo
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Open', n: appeals.filter((a) => a.status === 'open').length },
          { key: 'all', label: 'All', n: appeals.length },
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
              <DetailHead title={`Appeal from ${x.user}`} id={x.id} />
              <Facts
                items={[
                  { k: 'Original action', v: x.action },
                  { k: 'Rule', v: x.rule },
                  { k: 'Decided by', v: x.by },
                  { k: 'Filed', v: agoLabel(x.age) },
                ]}
              />
              <DetailBlock label="User says">
                <span className="text-[13px] leading-[1.5] text-fg-2">{x.text}</span>
              </DetailBlock>
              <NoteBox
                value={note}
                onChange={setNote}
                placeholder="Reason for your decision (sent to the user)"
              />
              <ActionRow>
                <Action
                  label="Uphold decision"
                  onClick={() => resolve('upheld', `Upheld ${x.id}.`)}
                  disabled={same}
                />
                <Action
                  label="Overturn"
                  kind="pri"
                  onClick={() => resolve('overturned', `Overturned. ${x.user} is restored and notified.`)}
                  disabled={same}
                />
              </ActionRow>
              {same && (
                <Warn>You made the original decision. Another moderator must review this appeal.</Warn>
              )}
            </>
          )
        }
      />
    </>
  );
}
