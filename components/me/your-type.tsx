'use client';

import { useCallback, useEffect, useState } from 'react';

type Trait = { key: string; label: string; weight: number; flag: 'like' | 'avoid' | null };

/** ★ Your type: what πroka learned from your taps, with ✓ like / ✕ not for me per trait. Premium. */
export function YourType() {
  const [state, setState] = useState<{ locked: boolean; traits: Trait[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/taste', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setState(j))
      .catch(() => null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setFlag = async (t: Trait, flag: 'like' | 'avoid') => {
    setBusy(true);
    const next = t.flag === flag ? null : flag;
    if (next) {
      await fetch('/api/taste', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trait: t.key, flag: next }),
      });
    } else {
      await fetch(`/api/taste?trait=${encodeURIComponent(t.key)}`, { method: 'DELETE' });
    }
    setBusy(false);
    load();
  };

  const reset = async () => {
    if (!confirm('Reset what πroka learned about your type?')) return;
    setBusy(true);
    await fetch('/api/taste', { method: 'DELETE' });
    setBusy(false);
    load();
  };

  return (
    <section aria-label="Your type" className="glass flex flex-col gap-3 rounded-card px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">★ Your type</p>
          <p className="text-[12px] text-fg-3">Learned from what you open, like and chat. You stay in control.</p>
        </div>
        {state && !state.locked && state.traits.length > 0 && (
          <button type="button" onClick={reset} disabled={busy} className="btn-ghost h-10 shrink-0 text-[12px]">
            Reset
          </button>
        )}
      </div>

      {!state ? (
        <p className="text-[13px] text-fg-3">Loading…</p>
      ) : state.locked ? (
        <p className="text-[13px] text-fg-3">
          Premium learns your type and shows a match score on every profile.{' '}
          <a href="/app/me/plan" className="font-semibold text-green">
            See Premium ›
          </a>
        </p>
      ) : state.traits.length === 0 ? (
        <p className="text-[13px] text-fg-3">Open a few profiles and it starts to learn.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.traits.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[13px]">{t.label}</span>
              <span className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  aria-pressed={t.flag === 'like'}
                  onClick={() => setFlag(t, 'like')}
                  disabled={busy}
                  className={`chip h-10 ${t.flag === 'like' ? 'chip-selected' : ''}`}
                >
                  ✓ Like
                </button>
                <button
                  type="button"
                  aria-pressed={t.flag === 'avoid'}
                  onClick={() => setFlag(t, 'avoid')}
                  disabled={busy}
                  className={`chip h-10 ${t.flag === 'avoid' ? 'chip-selected' : ''}`}
                >
                  ✕ Not for me
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
