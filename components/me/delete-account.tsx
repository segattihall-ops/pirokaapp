'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearSignalStore } from '@/lib/encryption/signal-store';

/** Danger zone: permanent deletion with a typed confirmation. */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const wipe = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/me/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: typed.trim() }),
    }).catch(() => null);
    if (!r?.ok) {
      setBusy(false);
      return setErr((await r?.json().catch(() => ({})))?.error ?? 'Could not delete the account');
    }
    await clearSignalStore().catch(() => {});
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    router.replace('/?deleted=1');
    router.refresh();
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-card border-danger/30 px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Delete account</p>
      {!open ? (
        <>
          <p className="text-[13px] text-fg-3">Removes your profile, photos, chats, favourites and keys. Reports you filed or received are kept without your name. This cannot be undone.</p>
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost h-10 self-start px-0 text-[13px] text-danger">
            Delete my account…
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-fg-2">
            Type <span className="font-mono font-semibold text-fg">DELETE</span> to confirm.
          </p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE to confirm" className="input h-11" autoComplete="off" autoCapitalize="characters" />
          {err && (
            <p role="alert" className="text-[12px] text-danger">
              {err}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-secondary h-11 flex-1">
              Keep it
            </button>
            <button type="button" onClick={wipe} disabled={busy || typed.trim() !== 'DELETE'} className="btn-primary h-11 flex-1 bg-danger text-white hover:bg-danger">
              {busy ? '…' : 'Delete forever'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
