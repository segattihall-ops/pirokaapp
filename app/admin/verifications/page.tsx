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
import { agoLabel, seedVerifs, type SeedVerif } from '@/lib/admin/ts-seed';

type ApiVerif = {
  id: string;
  userId: string | null;
  userHandle: string | null;
  kind: string;
  detail: string;
  status: string;
  decidedAt: string | null;
};

const fromApi = (v: ApiVerif): SeedVerif => ({
  id: v.id,
  user: v.userHandle ?? v.userId?.slice(0, 8) ?? 'unknown',
  kind: v.kind,
  age: v.decidedAt ? Math.max(1, Math.round((Date.now() - new Date(v.decidedAt).getTime()) / 60000)) : 0,
  detail: v.detail,
  status: v.status,
});

export default function VerificationsPage() {
  const toast = useToast();
  const [configured, setConfigured] = useState(true);
  const [verifs, setVerifs] = useState<SeedVerif[]>([]);
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/verifications?status=${filt === 'all' ? '' : 'open'}`, {
      cache: 'no-store',
    }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { verifications: ApiVerif[] };
      setConfigured(true);
      setVerifs(j.verifications.map(fromApi));
    } else {
      // No backend → seeded queue (empty in production); actions mutate local state only.
      setConfigured(false);
      setVerifs(seedVerifs());
    }
  }, [filt]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return verifs
      .filter(
        (v) =>
          (filt === 'all' || v.status === 'open') && (!ql || JSON.stringify(v).toLowerCase().includes(ql)),
      )
      .map((v) => ({
        id: v.id,
        dot: '#34d399',
        title: `${v.kind} · ${v.user}`,
        meta: v.detail,
        tag: v.status,
        tagCol: v.status === 'open' ? '#34d399' : '#666',
      }));
  }, [verifs, filt, q]);

  const x = verifs.find((v) => v.id === sel && (filt === 'all' || v.status === 'open')) ?? null;

  const resolve = (status: string, msg: string) => async () => {
    if (!x) return;
    if (configured) {
      const r = await fetch('/api/admin/verifications', {
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
      setVerifs((vs) => vs.map((v) => (v.id === x.id ? { ...v, status } : v)));
    }
    setSel(null);
    setNote('');
    toast(msg);
  };

  return (
    <>
      <ConsoleHeader
        title="Verifications"
        sub="Items AI couldn’t confirm, plus low-confidence matches"
        search
        q={q}
        onQ={setQ}
        demo={!configured}
      />
      <FilterChips
        filters={[
          { key: 'open', label: 'Open', n: verifs.filter((v) => v.status === 'open').length },
          { key: 'all', label: 'All', n: verifs.length },
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
              <DetailHead title={`${x.kind} verification`} id={x.id} />
              <Facts
                items={[
                  { k: 'User', v: x.user },
                  { k: 'Submitted', v: x.age ? agoLabel(x.age) : 'just now' },
                ]}
              />
              <DetailBlock label="Automated check">
                <span className="text-[13px] leading-[1.5] text-fg-2">{x.detail}</span>
                <span className="text-[13px] leading-[1.5] text-fg-2">
                  The source image is deleted when you decide. Only the outcome is stored.
                </span>
              </DetailBlock>
              <NoteBox value={note} onChange={setNote} placeholder="Optional note to the user" />
              <ActionRow>
                <Action
                  label="Approve"
                  kind="pri"
                  onClick={resolve('approved', `Approved ${x.kind} for ${x.user}.`)}
                />
                <Action
                  label="Reject"
                  kind="danger"
                  onClick={resolve('rejected', `Rejected ${x.kind} for ${x.user}.`)}
                />
                <Action
                  label="Ask for a new one"
                  onClick={resolve('resubmit', `Asked ${x.user} to resubmit.`)}
                />
              </ActionRow>
            </>
          )
        }
      />
    </>
  );
}
