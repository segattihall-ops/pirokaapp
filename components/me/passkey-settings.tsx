'use client';

import { useCallback, useEffect, useState } from 'react';
import { biometricLabel, passkeysSupported, registerPasskey } from '@/lib/auth/passkey-client';

type Passkey = { id: string; label: string | null; backed_up: boolean; created_at: string; last_used_at: string | null };

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return 'This device';
}

/** "Sign in with Face ID" setup on the Me screen. */
export function PasskeySettings() {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [supported, setSupported] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/auth/passkey/list', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setList(r.ok ? j.passkeys : []);
  }, []);

  useEffect(() => {
    setSupported(passkeysSupported());
    setLabel(biometricLabel());
    load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    setMsg('');
    try {
      await registerPasskey(deviceName());
      setMsg(`${label} is on. Next time, tap "Sign in with ${label}".`);
      load();
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (m !== 'Cancelled.') setMsg(m || 'Could not turn it on.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this device? You will need another way to sign in on it.')) return;
    await fetch(`/api/auth/passkey/list?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="glass flex flex-col rounded-card px-4 py-2">
      <p className="py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Sign-in</p>
      <div className="flex items-center justify-between gap-3 border-t border-line-1 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Sign in with {label}</p>
          <p className="text-[12px] text-fg-3">
            {list && list.length > 0
              ? `On for ${list.length} device${list.length > 1 ? 's' : ''}. No password, no email link.`
              : 'No password, no email link. Your face never leaves your phone.'}
          </p>
        </div>
        {supported ? (
          <button type="button" onClick={add} disabled={busy} className="btn-secondary h-9 shrink-0 text-[13px]">
            {busy ? '…' : list && list.length > 0 ? 'Add device' : 'Turn on'}
          </button>
        ) : (
          <span className="shrink-0 text-[12px] text-fg-4">Not supported here</span>
        )}
      </div>
      {list?.map((p) => (
        <div key={p.id} className="flex items-center justify-between border-t border-line-1 py-2.5 text-[12px]">
          <span className="text-fg-2">
            {p.label ?? 'Device'}
            {p.backed_up ? ' · synced' : ''}
            <span className="text-fg-4">
              {' '}
              · {p.last_used_at ? `used ${new Date(p.last_used_at).toLocaleDateString()}` : 'not used yet'}
            </span>
          </span>
          <button type="button" onClick={() => remove(p.id)} className="text-fg-3 hover:text-danger">
            Remove
          </button>
        </div>
      ))}
      {msg && (
        <p role="status" className="pb-2 text-[12px] text-fg-3">
          {msg}
        </p>
      )}
    </div>
  );
}
