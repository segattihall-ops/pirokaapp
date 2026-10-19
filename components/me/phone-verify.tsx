'use client';

import { useEffect, useState } from 'react';

type State = { phoneVerified: boolean; phone: string | null; configured: boolean };

/**
 * ME → earn the phone trust badge. Sends an SMS code (Twilio Verify) and confirms it. Renders nothing
 * until phone verification is configured for the environment, so it never shows a dead control.
 */
export function PhoneVerify() {
  const [state, setState] = useState<State | null>(null);
  const [step, setStep] = useState<'idle' | 'phone' | 'code'>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    fetch('/api/me/phone', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setState(j))
      .catch(() => setState(null));
  useEffect(() => {
    void load();
  }, []);

  if (!state || !state.configured) return null; // not available in this environment

  const send = async () => {
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) return setErr('Use the full number with country code, e.g. +15551234567');
    setBusy(true);
    setErr('');
    setMsg('');
    const r = await fetch('/api/me/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', phone }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(typeof j.error === 'string' ? j.error : 'Could not send the code.');
    setStep('code');
    setMsg('Code sent by SMS.');
  };

  const check = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const r = await fetch('/api/me/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', phone, code }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(typeof j.error === 'string' ? j.error : 'Could not verify that code.');
    setStep('idle');
    setCode('');
    setMsg('Phone verified.');
    void load();
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Phone</p>
        {state.phoneVerified && (
          <span className="rounded-chip bg-sel-fill px-2 py-0.5 text-[11px] font-semibold text-green">
            Verified
          </span>
        )}
      </div>

      {state.phoneVerified ? (
        <p className="text-[13px] leading-[1.5] text-fg-2">
          Your number is verified. A phone badge shows on your profile.
        </p>
      ) : (
        <p className="text-[13px] leading-[1.5] text-fg-4">
          Verify a phone number to earn a trust badge. Your number stays private — it is never shown to
          others.
        </p>
      )}

      {step === 'idle' ? (
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setErr('');
            setMsg('');
          }}
          className="btn-secondary mt-1 h-10 text-[13px]"
        >
          {state.phoneVerified ? 'Verify a new number' : 'Verify my phone'}
        </button>
      ) : (
        <div className="mt-1 flex flex-col gap-2 rounded-input border border-line-1 p-3">
          {step === 'phone' ? (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
                Phone number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="+15551234567"
                  className="input h-11 font-normal text-fg"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('idle')} className="btn-secondary h-10 flex-1 text-[13px]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={busy}
                  className="btn-primary h-10 flex-1 bg-green text-[13px] hover:bg-green-hover"
                >
                  {busy ? '…' : 'Send code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
                Code sent to {phone}
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="123456"
                  className="input h-11 font-normal tracking-[0.3em] text-fg"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep('phone')} className="btn-secondary h-10 flex-1 text-[13px]">
                  Back
                </button>
                <button
                  type="button"
                  onClick={check}
                  disabled={busy}
                  className="btn-primary h-10 flex-1 bg-green text-[13px] hover:bg-green-hover"
                >
                  {busy ? '…' : 'Verify'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      {msg && <p className="text-[12px] text-green">{msg}</p>}
    </div>
  );
}
