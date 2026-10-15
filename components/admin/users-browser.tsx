'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = {
  id: string;
  handle: string | null;
  email: string | null;
  plan: string;
  subscription_status: string | null;
  mod_step: string | null;
  age_verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  deleted_at: string | null;
  marketing_opt_out: boolean;
  auth_provider: string;
};

type Detail = {
  user: Row & {
    paypal_subscription_id: string | null;
    visibility: string;
    cancelled_at: string | null;
    payment_failed_at: string | null;
    verified_at: string | null;
  };
  events: { event: string; props: Record<string, unknown>; path: string | null; created_at: string }[];
  emails: { template: string; subject: string; status: string; provider: string; created_at: string }[];
  payments: { payment_id: string; amount: number; currency: string; status: string; created_at: string }[];
  modActions: {
    id: string;
    step: string;
    reason: string;
    rule_ref: string;
    expires_at: string | null;
    created_at: string;
  }[];
  reports: { about: number; filed: number };
};

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function UsersBrowser() {
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [flag, setFlag] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [step, setStep] = useState('warn');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (plan) p.set('plan', plan);
    if (flag) p.set('flag', flag);
    const r = await fetch(`/api/admin/users?${p}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRows(r.ok ? j.users : []);
    if (!r.ok) setMsg(j.error ?? 'Could not load users');
  }, [q, plan, flag]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (id: string) => {
    setDetail(null);
    const r = await fetch(`/api/admin/users/${id}`, { cache: 'no-store' });
    if (r.ok) setDetail(await r.json());
    else setMsg('Could not load user');
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!detail) return;
    setBusy(true);
    setMsg('');
    const r = await fetch(`/api/admin/users/${detail.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? 'Saved.' : (j.error ?? 'Update failed'));
    if (r.ok) {
      open(detail.user.id);
      load();
    }
  };

  const modAction = async () => {
    if (!detail || !reason.trim()) return;
    setBusy(true);
    const r = await fetch('/api/admin/mod-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: detail.user.id, step, reason }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `Applied "${j.step}".` : (j.error ?? 'Action failed'));
    if (r.ok) {
      setReason('');
      open(detail.user.id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search handle, email or id"
          className="input h-10 min-w-[220px] flex-1"
          aria-label="Search users"
        />
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="input h-10 py-0"
          aria-label="Plan"
        >
          <option value="">Any plan</option>
          <option value="free">Free</option>
          <option value="plus">Plus</option>
          <option value="premium">Premium</option>
          <option value="anonymous">Anonymous</option>
        </select>
        <select
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          className="input h-10 py-0"
          aria-label="Filter"
        >
          <option value="">Active accounts</option>
          <option value="moderated">Under moderation</option>
          <option value="failed_payment">Payment failed</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="max-h-[640px] overflow-y-auto rounded-card border border-line-1">
          {rows === null ? (
            <p className="py-8 text-center text-fg-3">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-fg-3">No users match.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-ink-900 text-left text-fg-3">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Seen</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => open(u.id)}
                    className={`cursor-pointer border-t border-line-1 hover:bg-white/[0.04] ${detail?.user.id === u.id ? 'bg-white/[0.06]' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-semibold text-fg">{u.handle ? `@${u.handle}` : 'Anonymous'}</p>
                      <p className="truncate text-fg-3">{u.email ?? u.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {u.plan}
                      {u.mod_step && (
                        <span className="ml-1 rounded bg-red-900 px-1 text-[10px] uppercase text-red-200">
                          {u.mod_step}
                        </span>
                      )}
                      {u.subscription_status === 'PAYMENT_FAILED' && (
                        <span className="ml-1 rounded bg-ink-750 px-1 text-[10px] uppercase text-warning">
                          dunning
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-fg-3">{ago(u.last_seen_at)}</td>
                    <td className="px-3 py-2 text-fg-3">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detail ? (
          <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto rounded-card border border-line-2 bg-white/[0.04] p-4 text-[12px]">
            <div>
              <h3 className="text-[15px] font-bold text-white">
                {detail.user.handle ? `@${detail.user.handle}` : 'Anonymous'}
              </h3>
              <p className="text-fg-3">
                {detail.user.email ?? 'no email'} · {detail.user.auth_provider} · id {detail.user.id}
              </p>
              <p className="text-fg-3">
                Joined {new Date(detail.user.created_at).toLocaleString()} · seen{' '}
                {ago(detail.user.last_seen_at)} · {detail.user.age_verified ? '18+ verified' : 'not verified'}{' '}
                · visibility {detail.user.visibility}
                {detail.user.deleted_at ? ' · DELETED' : ''}
              </p>
              <p className="text-fg-3">
                Reports about: {detail.reports.about} · filed: {detail.reports.filed}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-fg-2">
                  Plan ({detail.user.subscription_status ?? '—'})
                </span>
                <select
                  value={detail.user.plan}
                  disabled={busy}
                  onChange={(e) => patch({ plan: e.target.value, reason: 'admin override' })}
                  className="input h-9 py-0"
                >
                  <option value="free">Free</option>
                  <option value="plus">Plus (comped)</option>
                  <option value="premium">Premium (comped)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-fg-2">Marketing email</span>
                <select
                  value={detail.user.marketing_opt_out ? 'off' : 'on'}
                  disabled={busy}
                  onChange={(e) => patch({ marketingOptOut: e.target.value === 'off' })}
                  className="input h-9 py-0"
                >
                  <option value="on">Allowed</option>
                  <option value="off">Opted out</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-card border border-line-1 p-3">
              <div>
                <p className="font-semibold text-fg-2">Age re-check</p>
                <p className="text-fg-4">Revokes 18+ and requires an ID document before they can return.</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!detail || !confirm('Revoke 18+ and require an ID check?')) return;
                  setBusy(true);
                  const r = await fetch(`/api/admin/users/${detail.user.id}/age-recheck`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'reported underage' }),
                  });
                  setBusy(false);
                  setMsg(r.ok ? 'ID re-check required.' : 'Could not require re-check.');
                  if (r.ok) open(detail.user.id);
                }}
                className="btn-secondary h-9 shrink-0 text-[12px]"
              >
                Require ID
              </button>
            </div>

            <div className="rounded-card border border-line-1 p-3">
              <p className="mb-2 font-semibold text-fg-2">Moderation ladder</p>
              <div className="flex gap-2">
                <select value={step} onChange={(e) => setStep(e.target.value)} className="input h-9 py-0">
                  <option value="warn">Warning</option>
                  <option value="limit">Limited (7 days)</option>
                  <option value="suspend">Suspended</option>
                  <option value="remove">Removed</option>
                </select>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason shown to the user"
                  className="input h-9 flex-1"
                />
                <button
                  type="button"
                  onClick={modAction}
                  disabled={busy || !reason.trim()}
                  className="h-9 rounded-btn bg-danger px-3 font-semibold text-ink-950 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
              {detail.modActions.length > 0 && (
                <ul className="mt-2 space-y-1 text-fg-3">
                  {detail.modActions.map((m) => (
                    <li key={m.id}>
                      {new Date(m.created_at).toLocaleDateString()} ·{' '}
                      <span className="uppercase">{m.step}</span> · {m.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Section title={`Payments (${detail.payments.length})`}>
              {detail.payments.map((p) => (
                <li key={p.payment_id}>
                  {new Date(p.created_at).toLocaleDateString()} · {p.currency} {Number(p.amount).toFixed(2)} ·{' '}
                  {p.status}
                </li>
              ))}
            </Section>
            <Section title={`Emails (${detail.emails.length})`}>
              {detail.emails.map((e, i) => (
                <li key={i}>
                  {new Date(e.created_at).toLocaleDateString()} · {e.template} · {e.status}
                </li>
              ))}
            </Section>
            <Section title={`Recent events (${detail.events.length})`}>
              {detail.events.map((e, i) => (
                <li key={i} className="font-mono">
                  {ago(e.created_at)} · {e.event}
                  {e.path ? ` · ${e.path}` : ''}
                </li>
              ))}
            </Section>
          </div>
        ) : (
          <p className="hidden self-center text-center text-[13px] text-fg-4 lg:block">Select a user.</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-card border border-line-1 p-3" open>
      <summary className="cursor-pointer font-semibold text-fg-2">{title}</summary>
      <ul className="mt-2 space-y-1 text-fg-3">{children}</ul>
    </details>
  );
}
