'use client';

import { useEffect, useRef, useState } from 'react';

type PlanId = 'plus' | 'premium';
type Status = { configured: boolean; plan: 'free' | 'plus' | 'premium' | 'anonymous'; status: string | null };

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';
const PLAN_IDS: Record<PlanId, string> = {
  plus: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PLUS_ID ?? '',
  premium: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PREMIUM_ID ?? '',
};

const PLANS: { id: PlanId; name: string; price: number; features: string[] }[] = [
  { id: 'plus', name: 'Plus', price: 5, features: ['Album up to 5 photos', 'Saved trips', 'Priority support'] },
  {
    id: 'premium',
    name: 'Premium',
    price: 10,
    features: ['Everything in Plus', 'Taste learning & match scoring', 'Smart search', 'Early access'],
  },
];

declare global {
  interface Window {
    paypal?: any;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadPayPalSdk() {
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&vault=true&intent=subscription&components=buttons`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export function PayPalCheckout({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<PlanId>('plus');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const buttonsRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<any>(null);

  const refresh = async () => {
    const r = await fetch('/api/billing/status', { cache: 'no-store' });
    if (r.ok) setStatus(await r.json());
  };

  useEffect(() => {
    refresh();
  }, []);

  const subscribed = status && (status.plan === 'plus' || status.plan === 'premium');
  const configured = Boolean(CLIENT_ID && PLAN_IDS.plus && PLAN_IDS.premium) && status?.configured !== false;

  useEffect(() => {
    if (!configured || subscribed || !buttonsRef.current) return;
    let cancelled = false;
    loadPayPalSdk()
      .then(() => {
        if (cancelled || !buttonsRef.current || !window.paypal) return;
        rendered.current?.close?.();
        buttonsRef.current.innerHTML = '';
        rendered.current = window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
          createSubscription: (_data: unknown, actions: any) =>
            actions.subscription.create({ plan_id: PLAN_IDS[selected], custom_id: userId }),
          onApprove: async (data: { subscriptionID: string }) => {
            setBusy(true);
            setMsg('');
            const r = await fetch('/api/billing/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscriptionId: data.subscriptionID }),
            });
            const j = await r.json().catch(() => ({}));
            setMsg(r.ok ? `You're on ${j.plan}. Thank you!` : (j.error ?? 'Could not confirm subscription.'));
            setBusy(false);
            refresh();
          },
          onError: (e: unknown) => {
            console.error(e);
            setMsg('PayPal could not start the subscription.');
          },
        });
        rendered.current.render(buttonsRef.current);
      })
      .catch((e) => setMsg(e.message));
    return () => {
      cancelled = true;
    };
  }, [configured, subscribed, selected, userId]);

  const cancel = async () => {
    if (!confirm('Cancel your subscription? You keep access until the end of the billing period.')) return;
    setBusy(true);
    const r = await fetch('/api/billing/cancel', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Subscription cancelled.' : (j.error ?? 'Could not cancel.'));
    setBusy(false);
    refresh();
  };

  return (
    <div className="flex flex-col gap-5 rounded-hero border border-line-1 bg-ink-900 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-white">Your plan</h2>
          <p className="text-[13px] text-fg-3">
            {status ? (
              subscribed ? (
                <>
                  <span className="font-semibold capitalize text-green">{status.plan}</span>
                  {status.status ? ` · ${status.status.toLowerCase().replace('_', ' ')}` : ''}
                </>
              ) : (
                'Free'
              )
            ) : (
              'Loading…'
            )}
          </p>
        </div>
        {subscribed && (
          <button type="button" onClick={cancel} disabled={busy} className="btn-secondary h-10 text-[13px]">
            Cancel
          </button>
        )}
      </div>

      {!subscribed && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`rounded-card border-2 p-4 text-left transition-colors ${
                  selected === p.id ? 'border-green bg-white/[0.08]' : 'border-line-2 bg-white/[0.04] hover:border-line-3'
                }`}
              >
                <div className="text-[15px] font-bold text-white">{p.name}</div>
                <div className="mt-1 text-[20px] font-bold text-green">${p.price}/mo</div>
                <ul className="mt-3 space-y-1 text-[12px] text-fg-3">
                  {p.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          {configured ? (
            <div ref={buttonsRef} className="min-h-[48px]" />
          ) : (
            <p className="rounded-input border border-dashed border-line-2 px-3.5 py-3 text-[13px] text-fg-3">
              Billing is not configured yet. Set <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> and the two plan IDs.
            </p>
          )}
        </>
      )}

      {msg && (
        <p role="status" className="text-[13px] text-fg-2">
          {msg}
        </p>
      )}
    </div>
  );
}
