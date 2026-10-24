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
  Warn,
  type QueueRow,
} from '@/components/admin/console/ui';
import { useRole, useToast } from '@/components/admin/console/shell';
import { RULES, agoLabel, seedReports, type SeedReport } from '@/lib/admin/ts-seed';
import { compareReportQueue, severityLabel, severityRank } from '@/lib/safety/reasons';

type Report = {
  id: string;
  reason: string;
  target: string;
  targetId: string | null;
  reporter: string;
  ageMin: number;
  createdAt: string;
  sev: 1 | 2 | 3;
  details: string;
  evidence: boolean;
  reporterIp?: string | null;
  publicForm?: {
    link: string | null;
    contactEmail: string | null;
    label: string | null;
    tida: {
      signature: string | null;
      capacity: 'self' | 'authorized' | null;
      receivedAt: string | null;
      deadlineAt: string | null;
    } | null;
  } | null;
  priors: string[];
  status: string;
};

const sevCol = (v: number) => (v === 3 ? '#f87171' : v === 2 ? '#fbbf24' : '#999');

function fromSeed(r: SeedReport): Report {
  return {
    ...r,
    targetId: null,
    ageMin: r.age,
    createdAt: new Date(Date.now() - r.age * 60000).toISOString(),
  };
}

export default function ReportsPage() {
  const { role } = useRole();
  const toast = useToast();
  const admin = role === 'Admin';
  const [configured, setConfigured] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [filt, setFilt] = useState<'open' | 'all'>('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [rule, setRule] = useState<string>(RULES[0]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/reports?status=${filt === 'all' ? '' : 'open'}`, {
      cache: 'no-store',
    }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as {
        reports: {
          id: string;
          reason: string;
          targetId: string | null;
          targetHandle: string | null;
          reporterHandle: string | null;
          details: string | null;
          status: string;
          createdAt: string;
          reporterIp?: string | null;
          publicForm?: {
            link: string | null;
            contactEmail: string | null;
            label: string | null;
            tida: {
              signature: string | null;
              capacity: 'self' | 'authorized' | null;
              receivedAt: string | null;
              deadlineAt: string | null;
            } | null;
          } | null;
        }[];
      };
      setConfigured(true);
      setReports(
        j.reports.map((x) => ({
          id: x.id,
          reason: x.reason,
          target: x.targetHandle ?? x.targetId?.slice(0, 8) ?? 'unknown',
          targetId: x.targetId,
          reporter: x.reporterHandle ?? 'someone',
          ageMin: Math.max(1, Math.round((Date.now() - new Date(x.createdAt).getTime()) / 60000)),
          createdAt: x.createdAt,
          sev: severityRank(x.reason),
          details: x.details ?? '—',
          evidence: false,
          reporterIp: x.reporterIp ?? null,
          publicForm: x.publicForm ?? null,
          priors: [],
          status: x.status === 'open' || x.status === 'under_review' ? 'open' : x.status,
        })),
      );
    } else {
      // No backend → faithful seeded queue (clearly labelled "Demo data"); actions mutate local state only.
      setConfigured(false);
      setReports(seedReports().map(fromSeed));
    }
  }, [filt]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: QueueRow[] = useMemo(() => {
    const ql = q.toLowerCase();
    return reports
      .filter(
        (r) =>
          (filt === 'all' || r.status === 'open') && (!ql || JSON.stringify(r).toLowerCase().includes(ql)),
      )
      .slice()
      .sort((a, b) => compareReportQueue(a, b))
      .map((r) => ({
        id: r.id,
        dot: sevCol(r.sev),
        title: `${r.reason} · ${r.target}`,
        meta: `by ${r.reporter} · ${agoLabel(r.ageMin)}`,
        tag: r.status === 'open' ? (r.sev === 3 ? 'SAFETY' : 'open') : r.status,
        tagCol: r.status === 'open' ? sevCol(r.sev) : '#666',
      }));
  }, [reports, filt, q]);

  const x = reports.find((r) => r.id === sel && (filt === 'all' || r.status === 'open')) ?? null;

  const filters = [
    { key: 'open', label: 'Open', n: reports.filter((r) => r.status === 'open').length },
    { key: 'all', label: 'All', n: reports.length },
  ];

  const resolveLocal = (id: string, status: string) => {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    setSel(null);
    setNote('');
  };

  const dismiss = async () => {
    if (!x) return;
    if (configured) {
      const r = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: x.id, status: 'dismissed' }),
      }).catch(() => null);
      // On failure keep the report selected and say so — never report a dismissal that didn't happen.
      if (!r?.ok) {
        const j = r ? await r.json().catch(() => null) : null;
        return toast(j?.error ?? 'Could not dismiss the report.');
      }
      await load();
      setSel(null);
      setNote('');
    } else resolveLocal(x.id, 'dismissed');
    toast(`Dismissed ${x.id}.`);
  };

  const act = (step: 'warn' | 'limit' | 'suspend' | 'remove', verb: string) => async () => {
    if (!x) return;
    if (configured) {
      if (!x.targetId) return toast('No target user on this report.');
      const r = await fetch('/api/admin/mod-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: x.targetId,
          step,
          reason: note.trim() || `${verb} after report ${x.id}`,
          ruleRef: rule,
          reportId: x.id,
        }),
      }).catch(() => null);
      if (!r?.ok) {
        const j = r ? await r.json().catch(() => null) : null;
        return toast(j?.error ?? 'Action failed.');
      }
      await load();
      setSel(null);
      setNote('');
    } else resolveLocal(x.id, 'actioned');
    toast(`${verb} ${x.target}. They’ll see the reason and can appeal.`);
  };

  return (
    <>
      <ConsoleHeader
        title="Reports"
        sub="Highest severity first · SLA: safety 4h, other 24h"
        search
        q={q}
        onQ={setQ}
        demo={!configured}
      />
      <FilterChips
        filters={filters}
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
              <DetailHead title={x.reason} id={x.id} />
              <Facts
                items={[
                  { k: 'Reported user', v: x.target },
                  { k: 'Reporter', v: x.reporter },
                  { k: 'Received', v: agoLabel(x.ageMin) },
                  { k: 'Severity', v: severityLabel(x.sev) },
                ]}
              />
              <DetailBlock
                label={`Reporter says${x.evidence ? ' · messages attached (decrypted by reporter)' : ''}`}
              >
                <span className="text-[13px] leading-[1.5] text-fg-2">{x.details}</span>
                {x.evidence && (
                  <span className="text-[13px] leading-[1.5] text-fg-2">
                    “you up?” · “why aren’t you answering” · “I’ll find you anyway”
                  </span>
                )}
              </DetailBlock>
              {x.publicForm && (
                <DetailBlock label="Filed from the public form (no account required)">
                  <span className="text-[13px] leading-[1.5] text-fg-2">
                    Reported: {x.publicForm.link || '— no link given —'}
                  </span>
                  <span className="text-[13px] leading-[1.5] text-fg-3">
                    {x.publicForm.contactEmail
                      ? `Reply to: ${x.publicForm.contactEmail}`
                      : 'No contact email left.'}
                  </span>
                  {x.publicForm.tida && (
                    <>
                      <span className="mt-1 text-[12px] font-semibold text-danger">TAKE IT DOWN / NCII request</span>
                      <span className="text-[12px] leading-[1.5] text-fg-3">
                        Signed by: {x.publicForm.tida.signature || '—'} · capacity:{' '}
                        {x.publicForm.tida.capacity || '—'}
                      </span>
                      <span className="text-[12px] leading-[1.5] text-fg-3">
                        Received:{' '}
                        {x.publicForm.tida.receivedAt
                          ? new Date(x.publicForm.tida.receivedAt).toLocaleString()
                          : '—'}
                      </span>
                      <span className="text-[12px] font-semibold leading-[1.5] text-danger">
                        48h deadline:{' '}
                        {x.publicForm.tida.deadlineAt
                          ? new Date(x.publicForm.tida.deadlineAt).toLocaleString()
                          : '—'}
                      </span>
                      <span className="text-[11px] leading-[1.45] text-fg-4">
                        Remove or disable the identified intimate image and make reasonable efforts to identify
                        and remove known identical copies when the request is valid and covered.
                      </span>
                    </>
                  )}
                </DetailBlock>
              )}
              {x.reporterIp && (
                <DetailBlock label="Origin (moderation only)">
                  <span className="font-mono text-[13px] leading-[1.5] text-fg-2">{x.reporterIp}</span>
                  <span className="text-[12px] leading-[1.5] text-fg-4">
                    Best-effort IP captured when the report was filed. Not shown to members; use only to spot
                    repeat or abusive reports.
                  </span>
                </DetailBlock>
              )}
              {x.priors.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-fg-3">History</span>
                  {x.priors.map((h) => (
                    <span key={h} className="text-[12px] text-fg-2">
                      · {h}
                    </span>
                  ))}
                </div>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-fg-3">Rule</span>
                <select
                  value={rule}
                  onChange={(e) => setRule(e.target.value)}
                  className="h-10 rounded-input border border-line-2 bg-ink-800 px-2.5 text-[13px] text-fg outline-none focus:border-sel-border"
                >
                  {RULES.map((ro) => (
                    <option key={ro} value={ro}>
                      {ro}
                    </option>
                  ))}
                </select>
              </label>
              <NoteBox
                value={note}
                onChange={setNote}
                placeholder="Note to the user (shown with the decision)"
              />
              <ActionRow>
                <Action label="Dismiss" onClick={dismiss} />
                <Action label="Warn" onClick={act('warn', 'Warned')} />
                <Action label="Limit 7d" onClick={act('limit', 'Limited')} />
                <Action label="Suspend 30d" onClick={act('suspend', 'Suspended')} kind="danger" />
                <Action
                  label="Remove"
                  onClick={act('remove', 'Removed')}
                  kind="danger"
                  disabled={!admin}
                  title={admin ? '' : 'Admins only'}
                />
              </ActionRow>
              {(x.reason === 'underage' || x.reason === 'Underage') && (
                <Warn>
                  Possible minor. An in-app underage report hides the account from the map, nearby, and
                  search, blocks new messages and matches, and flags Require ID. Release that hold from the
                  user page if the report is unfounded. It is not a ban and it does not delete anything.
                </Warn>
              )}
              {(x.reason === 'csam' || x.reason === 'CSAM' || x.reason === 'Illegal content') && (
                <Warn>
                  Possible child sexual exploitation. Do not download, copy, or forward the material merely
                  to review it, and do not destroy evidence. Follow the trained CSAM/NCMEC escalation process.
                </Warn>
              )}
              {x.reason === 'Trafficking' && (
                <Warn>
                  Possible trafficking or commercial sexual exploitation. Preserve relevant records, avoid
                  tipping off a suspected exploiter when that could increase risk, and escalate for trained
                  legal/safety review.
                </Warn>
              )}
            </>
          )
        }
      />
    </>
  );
}
