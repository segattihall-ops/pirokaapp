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
import { agoLabel, seedAppeals, type SeedAppeal } from '@/lib/admin/ts-seed';

type ApiAppeal = {
  id: string;
  userId: string | null;
  userHandle: string | null;
  action: string;
  rule: string;
  body: string;
  status: string;
  createdAt: string;
};

// The queue works in 'open' / 'upheld' / 'overturned' terms; the table stores pending / denied / granted.
const toRowStatus = (s: string) =>
  s === 'pending' ? 'open' : s === 'denied' ? 'upheld' : s === 'granted' ? 'overturned' : s;

const fromApi = (a: ApiAppeal): SeedAppeal => ({
  id: a.id,
  user: a.userHandle ?? a.userId?.slice(0, 8) ?? 'unknown',
  action: a.action,
  rule: a.rule,
  by: '—',
  age: Math.max(1, Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60000)),
  text: a.body,
  status: toRowStatus(a.status),
});

export default function AppealsPage() {
  const toast = useToast();
  const [configured, setConfigured] = useState(true);
  const [appeals, setAppeals] = useState<SeedAppeal[]>([]);
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/appeals?status=${filt === 'all' ? '' : 'pending'}`, {
      cache: 'no-store',
    }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { appeals: ApiAppeal[] };
      setConfigured(true);
      setAppeals(j.appeals.map(fromApi));
    } else {
      setConfigured(false);
      setAppeals(seedAppeals());
    }
  }, [filt]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // status: 'granted' (overturn) | 'denied' (uphold)
  const resolve = (status: 'granted' | 'denied', rowStatus: string, msg: string) => async () => {
    if (!x) return;
    if (configured) {
      const r = await fetch('/api/admin/appeals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: x.id, status }),
      }).catch(() => null);
      if (!r?.ok) {
        const j = r ? await r.json().catch(() => null) : null;
        return toast(j?.error ?? 'Could not save the decision.');
      }
      await load();
    } else {
      setAppeals((as) => as.map((a) => (a.id === x.id ? { ...a, status: rowStatus } : a)));
    }
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Appeals"
        sub="A member contesting a moderation action"
        search
        q={q}
        onQ={setQ}
        demo={!configured}
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
                <Action label="Uphold decision" onClick={resolve('denied', 'upheld', `Upheld ${x.id}.`)} />
                <Action
                  label="Overturn"
                  kind="pri"
                  onClick={resolve(
                    'granted',
                    'overturned',
                    `Overturned. ${x.user} is restored and notified.`,
                  )}
                />
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
