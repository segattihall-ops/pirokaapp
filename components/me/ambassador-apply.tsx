'use client';

import { useCallback, useEffect, useState } from 'react';

type Ambassador = {
  id: string;
  city: string;
  status: 'open' | 'active' | 'declined' | 'removed' | string;
  created_at: string;
};

// Statuses that count as a live application/role — the API blocks a second one, so we show status
// instead of the apply form. Declined/removed are not live, so the member may apply again.
const isLive = (s: string) => s === 'open' || s === 'active';

/**
 * ME → Become an ambassador. Reads GET /api/ambassadors for the member's own status; when there is no
 * live application/role it shows an apply form that POSTs city/hours/why. Ambassadors help moderate and
 * welcome newcomers in their city; approval is handled in the admin console.
 */
export function AmbassadorApply() {
  const [amb, setAmb] = useState<Ambassador | null | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState('');
  const [hours, setHours] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/ambassadors', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { ambassador: null }))
      .then((j) => setAmb(j.ambassador ?? null))
      .catch(() => setAmb(null));
  }, []);
  useEffect(load, [load]);

  const submit = async () => {
    if (city.trim().length < 1) return setErr('Tell us your city.');
    if (why.trim().length < 10) return setErr('A sentence or two on why helps us decide.');
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await fetch('/api/ambassadors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim(), hours: hours.trim() || undefined, why: why.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Could not send your application.');
      setMsg('Application sent — our team will be in touch.');
      setOpen(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const live = amb && isLive(amb.status);

  return (
    <div className="glass flex flex-col gap-2 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Ambassador</p>
        {live && (
          <span
            className={`rounded-chip px-2 py-0.5 text-[11px] font-semibold ${
              amb.status === 'active' ? 'bg-sel-fill text-green' : 'text-warning'
            }`}
          >
            {amb.status === 'active' ? 'Active' : 'Under review'}
          </span>
        )}
      </div>

      {amb === undefined ? (
        <p className="py-1 text-[13px] text-fg-4">Loading…</p>
      ) : amb && amb.status === 'active' ? (
        <p className="text-[13px] leading-[1.5] text-fg-2">
          You&apos;re an ambassador for {amb.city}. Thank you for keeping πroka safe and welcoming.
        </p>
      ) : amb && amb.status === 'open' ? (
        <p className="text-[13px] leading-[1.5] text-fg-2">
          Your application for {amb.city} is under review. We&apos;ll let you know soon.
        </p>
      ) : (
        <p className="text-[13px] leading-[1.5] text-fg-4">
          {amb && amb.status === 'declined'
            ? 'Your last application wasn’t accepted. You’re welcome to apply again.'
            : 'Help moderate and welcome newcomers in your city. Ambassadors can hide content pending review and verify places and events — they can’t ban or see private data.'}
        </p>
      )}

      {amb !== undefined &&
        !live &&
        (!open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setErr('');
              setMsg('');
            }}
            className="btn-secondary mt-1 h-10 text-[13px]"
          >
            Become an ambassador
          </button>
        ) : (
          <div className="mt-1 flex flex-col gap-2 rounded-input border border-line-1 p-3">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={120}
                placeholder="Where you’d help"
                className="input h-11 font-normal text-fg"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
              Time per week <span className="font-normal text-fg-4">(optional)</span>
              <input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                maxLength={40}
                placeholder="e.g. 2–3 hours"
                className="input h-11 font-normal text-fg"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
              Why you
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="What makes you a good ambassador for this community?"
                className="input py-2 font-normal text-fg"
              />
            </label>
            {err && (
              <p role="alert" className="text-[12px] text-danger">
                {err}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary h-10 flex-1 text-[13px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="btn-primary h-10 flex-1 bg-green text-[13px] hover:bg-green-hover"
              >
                {busy ? 'Sending…' : 'Send application'}
              </button>
            </div>
          </div>
        ))}

      {msg && <p className="text-[12px] text-green">{msg}</p>}
    </div>
  );
}
