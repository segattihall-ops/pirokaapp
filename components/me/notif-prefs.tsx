'use client';

import { useEffect, useState } from 'react';

const ROWS: { key: string; label: string; hint: string }[] = [
  { key: 'messages', label: 'Messages', hint: 'New encrypted messages' },
  { key: 'match', label: 'Mutual interest', hint: 'When someone you liked likes you back' },
  { key: 'arrival', label: 'Arrivals', hint: 'Favourites landing in your city' },
  { key: 'status', label: 'Status', hint: 'Favourites going live nearby' },
  { key: 'safety', label: 'Safety', hint: 'SafeMeet check-ins and alerts' },
];

export function NotifPrefs() {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/prefs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setPrefs(j.notif_prefs ?? {}))
      .catch(() => setPrefs({}));
  }, []);

  const toggle = async (key: string) => {
    if (!prefs) return;
    const next = !prefs[key];
    setSaving(key);
    setPrefs({ ...prefs, [key]: next });
    const r = await fetch('/api/me/prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: next }),
    });
    if (!r.ok) setPrefs({ ...prefs, [key]: !next });
    setSaving(null);
  };

  return (
    <div className="glass flex flex-col rounded-card px-4 py-2">
      <p className="py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">Notify me about</p>
      {ROWS.map((row) => {
        const on = prefs?.[row.key] !== false;
        return (
          <div key={row.key} className="flex items-center justify-between border-t border-line-1 py-3">
            <div>
              <p className="text-[14px] font-medium">{row.label}</p>
              <p className="text-[12px] text-fg-3">{row.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={row.label}
              disabled={!prefs || saving === row.key}
              onClick={() => toggle(row.key)}
              className={`tap-hit h-7 w-12 shrink-0 rounded-chip border transition-colors disabled:opacity-40 ${
                on ? 'border-sel-border bg-green' : 'border-line-3 bg-ink-800'
              }`}
            >
              <span
                className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition-transform ${
                  on ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
