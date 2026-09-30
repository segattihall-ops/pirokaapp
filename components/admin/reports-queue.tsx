'use client';

import { useCallback, useEffect, useState } from 'react';

type Report = {
  id: string;
  reporterId: string;
  reporterHandle: string | null;
  targetId: string;
  targetHandle: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  createdAt: string;
};

type Step = 'warn' | 'limit' | 'suspend' | 'remove';

const FILTERS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
];

export function ReportsQueue() {
  const [filter, setFilter] = useState('open');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [step, setStep] = useState<Step>('warn');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/reports${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setReports(r.ok ? j.reports : []);
    if (!r.ok) setMsg(j.error ?? 'Could not load reports');
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: Report['status']) => {
    setBusy(true);
    const r = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);
    if (!r.ok) return setMsg('Update failed');
    setSelected(null);
    load();
  };

  const act = async () => {
    if (!selected || !reason.trim()) return;
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/admin/mod-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selected.targetId,
        step,
        reason,
        ruleRef: selected.reason,
        reportId: selected.id,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? 'Action failed');
    setMsg(`Applied "${j.step}" to ${selected.targetHandle ? `@${selected.targetHandle}` : selected.targetId}.`);
    setSelected(null);
    setReason('');
    load();
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold text-white">Reports</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`chip ${filter === f.value ? 'chip-selected' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="max-h-[480px] space-y-2 overflow-y-auto">
          {reports === null ? (
            <p className="py-8 text-center text-fg-3">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="py-8 text-center text-fg-3">Nothing here.</p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full rounded-card border p-3 text-left transition-colors ${
                  selected?.id === r.id ? 'border-green bg-white/[0.08]' : 'border-line-2 bg-white/5 hover:border-line-3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-fg-2">
                      {r.id} · {r.targetHandle ? `@${r.targetHandle}` : r.targetId.slice(0, 8)}
                    </p>
                    <p className="truncate text-[12px] text-fg-3">{r.reason}</p>
                    <p className="text-[11px] text-fg-4">
                      by {r.reporterHandle ? `@${r.reporterHandle}` : 'anonymous'} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${
                      r.status === 'open' ? 'bg-red-900 text-red-200' : 'bg-ink-750 text-fg-2'
                    }`}
                  >
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <div className="flex flex-col gap-3 rounded-card border border-line-2 bg-white/[0.04] p-4">
            <div>
              <h3 className="text-[14px] font-bold text-white">{selected.id}</h3>
              <p className="text-[12px] text-fg-3">
                Reason: <span className="text-fg-2">{selected.reason}</span>
              </p>
              {selected.details && <p className="mt-1 whitespace-pre-wrap text-[12px] text-fg-3">{selected.details}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => setStatus(selected.id, 'under_review')} className="btn-secondary h-9 text-[12px]">
                Mark in review
              </button>
              <button type="button" disabled={busy} onClick={() => setStatus(selected.id, 'dismissed')} className="btn-secondary h-9 text-[12px]">
                Dismiss
              </button>
              <button type="button" disabled={busy} onClick={() => setStatus(selected.id, 'resolved')} className="btn-secondary h-9 text-[12px]">
                Resolve (no action)
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-fg-2">Moderation step</span>
              <select value={step} onChange={(e) => setStep(e.target.value as Step)} className="input h-10 py-0">
                <option value="warn">Warning</option>
                <option value="limit">Limited (7 days)</option>
                <option value="suspend">Suspended</option>
                <option value="remove">Removed</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-fg-2">Reason shown to the user</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input resize-none" />
            </label>
            <button
              type="button"
              onClick={act}
              disabled={busy || !reason.trim()}
              className="h-10 rounded-btn bg-danger text-[13px] font-semibold text-ink-950 disabled:opacity-40"
            >
              {busy ? '…' : 'Apply step & resolve report'}
            </button>
          </div>
        ) : (
          <p className="hidden self-center text-center text-[13px] text-fg-4 lg:block">Select a report to act on it.</p>
        )}
      </div>

      {msg && (
        <p role="status" className="text-[12px] text-fg-2">
          {msg}
        </p>
      )}
    </div>
  );
}
