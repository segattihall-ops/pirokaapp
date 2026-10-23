'use client';

import { useCallback, useEffect, useState } from 'react';
import { PayPalCheckout } from '@/components/billing/paypal-checkout';

import { BILLING_UNAVAILABLE_COPY, billingOff } from '@/lib/billing/checkout-ui';
import { PLAN_CATALOG, PLAN_PRICE_USD, fmtDay, isPaid, planLabel } from '@/lib/billing/plans';

type Status = {
  configured: boolean;
  billingEnabled?: boolean;
  schemaPending: boolean;
  plan: 'free' | 'plus' | 'premium' | 'anonymous';
  status: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  cancelAt: string | null;
  pausedUntil: string | null;
  comp: { plan: 'plus' | 'premium'; until: string } | null;
  payerEmail: string | null;
  billingEmail: string | null;
  paymentFailedAt: string | null;
};

type Receipt = {
  id: string;
  receiptNo: string;
  date: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
};

const Panel = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <section aria-label={label} className="glass flex flex-col gap-4 rounded-hero p-5 sm:p-6">
    {children}
  </section>
);

export function PlanBilling({ userId }: { userId: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [retain, setRetain] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [picking, setPicking] = useState<'plus' | 'premium' | null>(null);

  const refresh = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch('/api/billing/status', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/billing/receipts', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { receipts: [] })),
    ]);
    if (a) {
      setS(a);
      setEmail((cur) => cur || a.billingEmail || '');
    }
    setReceipts(b.receipts ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = async (url: string, body: unknown, method = 'POST') => {
    setBusy(true);
    setMsg('');
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    return { ok: r.ok, j };
  };

  if (!s) return <p className="text-[13px] text-fg-3">Loading your plan…</p>;

  const paid = isPaid(s.plan) && !s.comp;
  const paymentsClosed = billingOff(s);
  const current = planLabel(s.plan);
  const renew = fmtDay(s.renewsAt);
  const price = isPaid(s.plan) ? `$${PLAN_PRICE_USD[s.plan]}/mo` : 'Free';
  const cancelled = Boolean(s.cancelAt);
  const paused = Boolean(s.pausedUntil);

  const statusLine = s.schemaPending
    ? 'Billing details need a database update. Try again later.'
    : s.comp
      ? paymentsClosed
        ? `Complimentary ${planLabel(s.comp.plan)} until ${fmtDay(s.comp.until)}.`
        : `Complimentary ${planLabel(s.comp.plan)} until ${fmtDay(s.comp.until)}. Choose a plan before then to keep it.`
      : !isPaid(s.plan)
        ? paymentsClosed
          ? 'Core features are free forever.'
          : 'Core features are free forever. Upgrade any time.'
        : paused
          ? `Paused. Resumes ${fmtDay(s.pausedUntil)}. You won't be charged until then.`
          : cancelled
            ? `Cancelled. You keep ${current} until ${fmtDay(s.cancelAt)} and won't be charged again.`
            : s.paymentFailedAt
              ? 'Payment failed. Update your payment method in PayPal to keep your plan.'
              : `Renews ${renew} · ${price}`;

  const cancelAction = async () => {
    const { ok, j } = await post('/api/billing/cancel', { action: 'cancel' });
    setMsg(
      ok ? `Cancelled. You keep ${current} until ${fmtDay(j.cancelAt)}.` : (j.error ?? 'Could not cancel.'),
    );
    setRetain(false);
    refresh();
  };
  const pauseAction = async () => {
    const { ok, j } = await post('/api/billing/cancel', { action: 'pause' });
    setMsg(
      ok ? `Paused. Nothing is charged until ${fmtDay(j.pausedUntil)}.` : (j.error ?? 'Could not pause.'),
    );
    setRetain(false);
    refresh();
  };
  const resumeAction = async () => {
    const { ok, j } = await post('/api/billing/cancel', { action: 'resume' });
    if (ok) setMsg('Subscription resumed.');
    else if (j.needsCheckout)
      setMsg(
        billingOff(s)
          ? BILLING_UNAVAILABLE_COPY
          : 'Your subscription has ended. Choose a plan below to start again.',
      );
    else setMsg(j.error ?? 'Could not resume.');
    refresh();
  };
  const changeAction = async (target: 'plus' | 'premium') => {
    const { ok, j } = await post('/api/billing/change', { plan: target });
    if (!ok) return setMsg(j.error ?? 'Could not change plan.');
    if (j.needsCheckout) return setPicking(target);
    if (j.approveUrl) {
      window.location.href = j.approveUrl;
      return;
    }
    setMsg(`Switched to ${planLabel(target)}. The difference is credited to your next bill.`);
    refresh();
  };
  const saveEmail = async () => {
    const { ok, j } = await post('/api/billing/email', { email }, 'PATCH');
    setMsg(ok ? 'Receipts will go to that address.' : (j.error ?? 'Could not save email.'));
  };
  const redeem = async () => {
    if (!code.trim()) return;
    const { ok, j } = await post('/api/billing/promo', { code });
    setMsg(ok ? j.message : (j.error ?? 'That code is not valid.'));
    if (ok) setCode('');
    refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel label="Current plan">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              πroka {current}
              {isPaid(s.plan) ? ` · ${price}` : ''}
            </p>
            <p className="mt-1 text-[13px] text-fg-3">{statusLine}</p>
          </div>
          {s.comp && (
            <span className="shrink-0 rounded-chip border border-sel-border bg-sel-fill px-2.5 py-1 text-[11px] font-semibold text-green">
              Complimentary
            </span>
          )}
        </div>

        {paymentsClosed && (
          <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
            {BILLING_UNAVAILABLE_COPY}
          </p>
        )}

        {s.subscriptionId && isPaid(s.plan) && !retain && (
          <div className="flex flex-wrap gap-2">
            {!paymentsClosed && s.plan === 'plus' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeAction('premium')}
                className="btn-secondary"
              >
                Upgrade to Premium · $10/mo
              </button>
            )}
            {!paymentsClosed && s.plan === 'premium' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeAction('plus')}
                className="btn-secondary"
              >
                Switch to Plus · $5/mo
              </button>
            )}
            {cancelled || paused ? (
              <button type="button" disabled={busy} onClick={resumeAction} className="btn-primary">
                Resume subscription
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => setRetain(true)} className="btn-ghost">
                Cancel subscription
              </button>
            )}
          </div>
        )}

        {retain && s.subscriptionId && (
          <div className="flex flex-col gap-3 rounded-card border border-line-2 bg-ink-900 p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">Before you go</p>
            <p className="text-[14px]">
              You&apos;ll keep {current} until {renew} either way.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={busy} onClick={pauseAction} className="btn-primary">
                Pause for 30 days instead
              </button>
              {!paymentsClosed && s.plan === 'premium' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeAction('plus')}
                  className="btn-secondary"
                >
                  Switch to Plus · $5/mo
                </button>
              )}
              <button type="button" disabled={busy} onClick={cancelAction} className="btn-ghost text-danger">
                Cancel anyway
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p role="status" className="text-[13px] text-fg-2">
            {msg}
          </p>
        )}
      </Panel>

      {!paymentsClosed && (!s.subscriptionId || s.comp) && (
        <Panel label="Choose a plan">
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAN_CATALOG.filter((p) => p.key !== 'free').map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPicking(p.key as 'plus' | 'premium')}
                aria-pressed={picking === p.key}
                className={`flex flex-col gap-2 rounded-card border-2 p-4 text-left transition-colors ${
                  picking === p.key ? 'border-sel-border bg-sel-fill' : 'border-line-2 hover:border-line-3'
                }`}
              >
                <span className="text-[15px] font-bold">
                  {p.mark} {p.name}
                </span>
                <span className="text-[20px] font-bold text-green">{p.price}</span>
                <ul className="flex flex-col gap-1 text-[12px] text-fg-3">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          {picking && <PayPalCheckout userId={userId} mode="checkout" />}
        </Panel>
      )}

      <Panel label="Billing details">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">Payment method</p>
          <p className="text-[13px] text-fg-3">
            Your card is held by PayPal, not by πroka. Change it in your PayPal account.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="billing-email" className="text-[13px] font-semibold">
            Billing email
          </label>
          <div className="flex gap-2">
            <input
              id="billing-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Receipts go here (optional)"
              className="input h-12"
            />
            <button type="button" onClick={saveEmail} disabled={busy} className="btn-secondary shrink-0">
              Save
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-code" className="text-[13px] font-semibold">
            Promo or invite code
          </label>
          <div className="flex gap-2">
            <input
              id="promo-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 24))}
              onKeyDown={(e) => e.key === 'Enter' && redeem()}
              placeholder="PRIDE26 or PIROKA-…"
              autoCapitalize="characters"
              className="input h-12 uppercase tracking-[0.06em]"
            />
            <button
              type="button"
              onClick={redeem}
              disabled={busy || !code.trim()}
              className="btn-secondary shrink-0"
            >
              Redeem
            </button>
          </div>
        </div>
        <p className="text-[12px] text-fg-4">
          Subscribed on iPhone or Android? Manage it in your App Store or Google Play subscription settings.
        </p>
      </Panel>

      <Panel label="Receipts">
        <p className="text-[13px] font-semibold">Receipts</p>
        {receipts.length === 0 ? (
          <p className="text-[13px] text-fg-3">No charges yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-1">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px]">
                    {new Date(r.date).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    · {r.plan}
                  </p>
                  <p className="text-[12px] text-fg-3">
                    {r.receiptNo} · {r.status}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[14px] font-semibold">
                    {r.amount === 0 ? '$0.00' : `$${r.amount.toFixed(2)}`}
                  </span>
                  <a
                    href={`/api/billing/receipts/${encodeURIComponent(r.id)}`}
                    download
                    className="tap-link text-[13px] font-medium text-green"
                  >
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
