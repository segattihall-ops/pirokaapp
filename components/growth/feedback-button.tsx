'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

/** "Send feedback" card for the Me screen. Opens inline; one request, no page change. */
export function FeedbackButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'bug' | 'idea' | 'other'>('idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, message, path }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? 'Could not send. Try again.');
    setMessage('');
    setOpen(false);
    setMsg('Thanks — we read every message.');
  };

  return (
    <div className="glass flex flex-col rounded-card px-4 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between text-left text-[14px] font-medium"
        aria-expanded={open}
      >
        Send feedback
        <span className="text-fg-4">{open ? '–' : '›'}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-1.5">
            {(['bug', 'idea', 'other'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`chip capitalize ${kind === k ? 'chip-selected' : ''}`}
              >
                {k}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={
              kind === 'bug' ? 'What happened, and what did you expect?' : 'What would make πroka better?'
            }
            className="input resize-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || message.trim().length < 3}
            className="btn-primary h-10 text-[13px]"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className="mt-2 text-[12px] text-fg-3">
          {msg}
        </p>
      )}
    </div>
  );
}
