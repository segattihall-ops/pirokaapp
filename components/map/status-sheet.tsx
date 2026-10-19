'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { INTENTS, timeLeft } from '@/lib/geo/client';

export type MyStatus = {
  intent: string;
  starts_at: string;
  ends_at: string;
  travel_mi?: number | null;
} | null;

const DURATIONS = [0.5, 1, 2, 4];
const TRAVEL_MILES = [1, 3, 5, 10, 15];

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
  const [travelMi, setTravelMi] = useState(status?.travel_mi ?? 5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/me/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, hours, travelMi: intent === 'travel' ? travelMi : undefined }),
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
    <Sheet onClose={onClose} title="PIROKA Mode">
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
      {intent === 'travel' && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-fg-3">
            Can travel up to <span className="text-green">{travelMi} mi</span>
          </span>
          <div className="flex gap-2">
            {TRAVEL_MILES.map((mi) => (
              <button
                key={mi}
                type="button"
                onClick={() => setTravelMi(mi)}
                className={`chip ${travelMi === mi ? 'chip-selected' : ''}`}
              >
                {mi} mi
              </button>
            ))}
          </div>
        </div>
      )}
      {intent === 'couchless' && (
        <p className="rounded-input bg-white/[0.04] px-3 py-2.5 text-[12px] leading-relaxed text-fg-2">
          Couchless: you can&apos;t host and can&apos;t travel far. You&apos;ll figure it out together — a
          café, a walk, a bar nearby. Meet somewhere public first.
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-fg-3">For</span>
        {DURATIONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHours(h)}
            className={`chip ${hours === h ? 'chip-selected' : ''}`}
          >
            {h < 1 ? `${Math.round(h * 60)}m` : `${h}h`}
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
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn-primary h-12 flex-1 bg-green hover:bg-green-hover"
        >
          {busy ? '…' : status ? 'Update' : 'Go live'}
        </button>
      </div>
    </Sheet>
  );
}

/** Prototype layout: bottom sheets for controls, a right-side profile panel on desktop.
 * Portaled to body so MapLibre's transformed canvas cannot displace the dialog.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const side = title === 'Your profile' || title === 'Edit profile';

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${side ? 'rail:justify-end' : 'rail:justify-center'}`}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'πroka panel'}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <section
        className={`relative flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-sheet border border-b-0 border-line-2 bg-ink-850/95 shadow-sheet backdrop-blur-xl rail:max-h-[88dvh] ${side ? 'rail:h-dvh rail:max-h-dvh rail:max-w-[400px] rail:rounded-none rail:border-t-0 rail:border-r-0 rail:shadow-panel' : ''}`}
      >
        <div className="relative flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="h-1 w-9 rounded-full bg-line-3 rail:hidden" />
            {title && <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2 text-[20px] text-fg-3 hover:text-fg">×</button>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-[calc(22px+var(--safe-bottom))] rail:pb-5">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
