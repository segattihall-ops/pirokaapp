'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/auth/client';
import { clearSignalStore } from '@/lib/encryption/signal-store';
import { biometricLabel, passkeysSupported, registerPasskey } from '@/lib/auth/passkey-client';

/**
 * Anonymous accounts have no email or password: signing out loses them for good unless a passkey
 * is set. Those users get a warning with a one-tap way to turn on Face ID first.
 */
export function SignOutButton({ anonymous = false }: { anonymous?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState(false);
  const [err, setErr] = useState('');

  const doSignOut = async () => {
    setBusy(true);
    await clearSignalStore().catch(() => {});
    await signOut().catch(() => {});
    router.replace('/');
    router.refresh();
  };

  const click = async () => {
    if (!anonymous) return doSignOut();
    setBusy(true);
    const r = await fetch('/api/auth/passkey/list', { cache: 'no-store' }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if ((j.passkeys?.length ?? 0) > 0) return doSignOut();
    setWarn(true);
  };

  const protectThenLeave = async () => {
    setErr('');
    setBusy(true);
    try {
      await registerPasskey();
      await doSignOut();
    } catch (e) {
      setBusy(false);
      const m = e instanceof Error ? e.message : '';
      if (m !== 'Cancelled.') setErr(m || 'Could not turn it on.');
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={click} className="btn-ghost h-10 text-[13px]">
        {busy ? '…' : 'Sign out'}
      </button>
      {warn && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => !busy && setWarn(false)}
        >
          <div
            className="glass flex w-full max-w-[400px] flex-col gap-3 rounded-hero border border-line-2 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold">You&apos;ll lose this account</h2>
            <p className="text-[13px] text-fg-3">
              Anonymous accounts have no email or password. If you sign out now, your profile, chats and
              favourites can&apos;t be recovered.
            </p>
            {passkeysSupported() && (
              <button type="button" onClick={protectThenLeave} disabled={busy} className="btn-primary h-11">
                Turn on {biometricLabel()}, then sign out
              </button>
            )}
            <button type="button" onClick={() => setWarn(false)} disabled={busy} className="btn-secondary h-11">
              Stay signed in
            </button>
            <button type="button" onClick={doSignOut} disabled={busy} className="h-10 text-[13px] text-danger">
              Sign out and lose the account
            </button>
            {err && (
              <p role="alert" className="text-[12px] text-danger">
                {err}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
