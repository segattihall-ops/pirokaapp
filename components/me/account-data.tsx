'use client';

import { useEffect, useState } from 'react';

/** Marketing email switch + "Download my data" for the Me screen. */
export function AccountData() {
  const [marketing, setMarketing] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/me/marketing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setMarketing(Boolean(j.marketing)))
      .catch(() => setMarketing(true));
  }, []);

  const toggle = async () => {
    if (marketing === null) return;
    const next = !marketing;
    setSaving(true);
    setMarketing(next);
    const r = await fetch('/api/me/marketing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketing: next }),
    });
    if (!r.ok) setMarketing(!next);
    setSaving(false);
  };

  const download = async () => {
    setMsg('');
    const r = await fetch('/api/me/export', { cache: 'no-store' });
    if (!r.ok)
      return setMsg(
        r.status === 429 ? 'Three exports a day — try again tomorrow.' : 'Could not export right now.',
      );
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `piroka-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Downloaded.');
  };

  return (
    <div className="glass flex flex-col rounded-card px-4 py-2">
      <p className="py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Email & data</p>
      <div className="flex items-center justify-between border-t border-line-1 py-3">
        <div>
          <p className="text-[14px] font-medium">Product news by email</p>
          <p className="text-[12px] text-fg-3">Receipts and safety notices always arrive</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={marketing === true}
          aria-label="Product news by email"
          disabled={marketing === null || saving}
          onClick={toggle}
          className={`tap-hit relative h-7 w-12 shrink-0 rounded-chip border transition-colors disabled:opacity-40 ${marketing ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'}`}
        >
          <span
            className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition-transform ${marketing ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between border-t border-line-1 py-3">
        <div>
          <p className="text-[14px] font-medium">Download my data</p>
          <p className="text-[12px] text-fg-3">Everything we store about you, as JSON</p>
        </div>
        <button type="button" onClick={download} className="btn-secondary h-9 text-[13px]">
          Export
        </button>
      </div>
      {msg && (
        <p role="status" className="pb-2 text-[12px] text-fg-3">
          {msg}
        </p>
      )}
    </div>
  );
}
