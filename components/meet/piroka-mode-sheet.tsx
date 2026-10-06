'use client';

import { useCallback, useEffect, useState } from 'react';

interface PirokaModeState {
  isActive: boolean;
  destinationCity: string;
  appearsInDestination: boolean;
  revealDate: string | null;
}

export function PirokaModeSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<PirokaModeState>({
    isActive: false,
    destinationCity: '',
    appearsInDestination: true,
    revealDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/piroka/status', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as PirokaModeState | null;
        if (data) setMode(data);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/piroka/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode),
      });
      if (res.ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [mode, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-ink-950/50">
        <p className="text-fg-3">Loading…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink-950/50 sm:items-center sm:justify-center">
      <div className="w-full max-w-sm rounded-t-card bg-ink-950 p-6 sm:rounded-card">
        <h2 className="text-h3">Travel Mode</h2>
        <p className="mt-1 text-[13px] text-fg-3">Broadcast your location when traveling — stay discoverable on the road</p>

        <div className="mt-6 flex flex-col gap-4">
          {/* Toggle */}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={mode.isActive}
              onChange={(e) => setMode({ ...mode, isActive: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            <span className="text-[14px]">Enable Travel Mode</span>
          </label>

          {/* Destination (only if active) */}
          {mode.isActive && (
            <>
              <div>
                <label className="text-[12px] font-semibold text-fg-3">Destination City</label>
                <input
                  type="text"
                  placeholder="e.g., Miami, Barcelona"
                  value={mode.destinationCity}
                  onChange={(e) => setMode({ ...mode, destinationCity: e.target.value })}
                  className="mt-1.5 w-full rounded-input border border-line-1 bg-ink-850 px-3 py-2 text-[14px]"
                />
              </div>

              {/* Appear in destination */}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={mode.appearsInDestination}
                  onChange={(e) => setMode({ ...mode, appearsInDestination: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <span className="flex-1 text-[14px]">Show in destination search</span>
              </label>

              {/* Reveal date */}
              <div>
                <label className="text-[12px] font-semibold text-fg-3">When to appear (optional)</label>
                <input
                  type="date"
                  value={mode.revealDate || ''}
                  onChange={(e) => setMode({ ...mode, revealDate: e.target.value || null })}
                  className="mt-1.5 w-full rounded-input border border-line-1 bg-ink-850 px-3 py-2 text-[14px]"
                />
                <p className="mt-1 text-[12px] text-fg-3">Leave blank to appear immediately</p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
