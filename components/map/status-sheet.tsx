'use client';

import { useState } from 'react';
import { INTENTS, timeLeft } from '@/lib/geo/client';

export type MyStatus = { intent: string; starts_at: string; ends_at: string } | null;

const DURATIONS = [1, 2, 4, 8];

export function StatusSheet({
  status,
  onChange,
  onClose,
}: {
  status: MyStatus;
  onChange: (s: MyStatus) => void;
  onClose: () => void;
}) {
  const [intent, setIntent] = useState(status?.intent ?? 'now');
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/me/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, hours }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? 'Could not set status');
    onChange(j.status);
    onClose();
  };

  const clear = async () => {
    setBusy(true);
    await fetch('/api/me/status', { method: 'DELETE' });
    setBusy(false);
    onChange(null);
    onClose();
  };

  return (
    <Sheet onClose={onClose} title="What are you up to?">
      <p className="text-[13px] text-fg-3">
        Your intent shows on the map for the time you pick, then disappears. Your exact location never does.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {INTENTS.map((i) => (
          <button
            key={i.value}
            type="button"
            onClick={() => setIntent(i.value)}
            className={`flex min-h-[56px] items-center gap-3 rounded-card border px-3.5 text-left transition-colors ${
              intent === i.value ? 'border-sel-border bg-sel-fill' : 'border-line-2 bg-ink-850'
            }`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i.color }} />
            <span>
              <span className="block text-[14px] font-semibold">{i.label}</span>
              <span className="block text-[12px] text-fg-3">{i.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-fg-3">For</span>
        {DURATIONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHours(h)}
            className={`chip ${hours === h ? 'chip-selected' : ''}`}
          >
            {h}h
          </button>
        ))}
      </div>
      {err && (
        <p role="alert" className="text-[12px] text-danger">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        {status && (
          <button type="button" onClick={clear} disabled={busy} className="btn-secondary h-12 flex-1">
            End status ({timeLeft(status.ends_at)})
          </button>
        )}
        <button type="button" onClick={save} disabled={busy} className="btn-primary h-12 flex-1 bg-green hover:bg-green-hover">
          {busy ? '…' : status ? 'Update' : 'Go live'}
        </button>
      </div>
    </Sheet>
  );
}

/** Bottom sheet on phones, centered card on the rail layout. */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center rail:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[88dvh] w-full max-w-[520px] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-ink-900 px-5 pb-[calc(20px+var(--safe-bottom))] pt-3 shadow-sheet rail:rounded-sheet rail:pb-5">
        <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line-3 rail:hidden" />
        {title && <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
