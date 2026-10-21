'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type State = { photoVerified: boolean; hasPhoto: boolean; configured: boolean };

/**
 * ME → earn the photo trust badge: a live selfie matched 1:1 against your own profile photo (Didit).
 * It proves the person in the photos is really you. Renders nothing until the selfie face-match
 * workflow is configured for the environment, so it never shows a dead control.
 */
export function PhotoVerify() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () =>
    fetch('/api/me/photo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setState(j))
      .catch(() => setState(null));
  useEffect(() => {
    void load();
  }, []);

  if (!state || !state.configured) return null; // not available in this environment

  const start = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/me/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) {
      setBusy(false);
      return setErr(typeof j.error === 'string' ? j.error : 'Could not start the photo check.');
    }
    window.location.href = j.url as string;
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-card px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Photo</p>
        {state.photoVerified && (
          <span className="rounded-chip bg-sel-fill px-2 py-0.5 text-[11px] font-semibold text-green">
            Verified
          </span>
        )}
      </div>

      {state.photoVerified ? (
        <p className="text-[13px] leading-[1.5] text-fg-2">
          Your photos are verified. A photo badge shows on your profile.
        </p>
      ) : (
        <p className="text-[13px] leading-[1.5] text-fg-4">
          Take a quick live selfie to prove your photos are really you, and earn a trust badge.
        </p>
      )}

      {!state.hasPhoto ? (
        <Link
          href="/app/me/edit"
          className="btn-secondary mt-1 flex h-10 items-center justify-center text-[13px]"
        >
          Add a profile photo first
        </Link>
      ) : (
        <button type="button" onClick={start} disabled={busy} className="btn-secondary mt-1 h-10 text-[13px]">
          {busy ? '…' : state.photoVerified ? 'Verify again' : 'Verify my photos'}
        </button>
      )}

      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
