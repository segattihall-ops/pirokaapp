'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const REASONS: { value: string; label: string }[] = [
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'underage', label: 'Looks under 18' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'hate', label: 'Hate or discrimination' },
  { value: 'unsafe', label: 'Unsafe meet-up behaviour' },
  { value: 'other', label: 'Something else' },
];

export function SafetyMenu({
  peerUserId,
  peerHandle,
  conversationId,
  onBlocked,
}: {
  peerUserId: string;
  peerHandle: string | null;
  conversationId?: string;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'report' | 'done'>('menu');
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const name = peerHandle ? `@${peerHandle}` : 'this person';

  const report = async () => {
    setBusy(true);
    setErr('');
    const r = await fetch('/api/safety/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: peerUserId, reason, details, ...(conversationId ? { conversationId } : {}) }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? 'Could not send report');
    setMode('done');
  };

  const block = async () => {
    if (!confirm(`Block ${name}? They won't be able to message you and this chat will disappear from your inbox.`)) return;
    setBusy(true);
    const r = await fetch('/api/safety/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: peerUserId }),
    });
    setBusy(false);
    if (!r.ok) return setErr('Could not block');
    if (onBlocked) onBlocked();
    else router.replace('/app/chats');
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Safety options"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setMode('menu');
          setErr('');
        }}
        className="tap flex h-10 w-10 items-center justify-center rounded-[12px] text-fg-3 hover:bg-ink-850 hover:text-fg"
      >
        ⋯
      </button>

      {open && (
        <div className="glass absolute right-0 top-11 z-30 w-[280px] rounded-card p-3 text-[13px] shadow-float">
          {mode === 'menu' && (
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => setMode('report')} className="rounded-input px-3 py-2.5 text-left hover:bg-white/5">
                Report {name}
              </button>
              <button type="button" onClick={block} disabled={busy} className="rounded-input px-3 py-2.5 text-left text-danger hover:bg-white/5">
                Block {name}
              </button>
            </div>
          )}

          {mode === 'report' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                report();
              }}
              className="flex flex-col gap-2"
            >
              <p className="font-semibold text-fg-2">Report {name}</p>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="input h-10 py-0 text-[13px]">
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What happened? (optional)"
                className="input resize-none text-[13px]"
              />
              <p className="text-[11px] text-fg-4">Messages stay encrypted; only what you write here is shared with moderators.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode('menu')} className="btn-secondary h-9 flex-1 text-[12px]">
                  Back
                </button>
                <button type="submit" disabled={busy} className="btn-primary h-9 flex-1 text-[12px]">
                  {busy ? '…' : 'Send report'}
                </button>
              </div>
            </form>
          )}

          {mode === 'done' && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-green">Report sent</p>
              <p className="text-fg-3">A moderator will review it. You can also block {name}.</p>
              <button type="button" onClick={block} disabled={busy} className="btn-secondary h-9 text-[12px] text-danger">
                Block {name}
              </button>
            </div>
          )}

          {err && (
            <p role="alert" className="mt-2 text-[12px] text-danger">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
