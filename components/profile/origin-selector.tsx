'use client';

import { useState, useEffect } from 'react';
import { COUNTRIES } from '@/lib/countries';

interface OriginSelectorProps {
  initialOrigin?: string;
  onUpdate?: (origin: string | null) => void;
}

export function OriginSelector({ initialOrigin, onUpdate }: OriginSelectorProps) {
  const [selected, setSelected] = useState<string | null>(initialOrigin || null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.code === selected);

  const handleSelect = async (code: string) => {
    setSelected(code);
    setOpen(false);
    setLoading(true);

    try {
      const res = await fetch('/api/me/origin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originCode: code }),
      });

      if (!res.ok) {
        setSelected(initialOrigin || null);
        console.error('Failed to update origin');
        return;
      }

      const data = await res.json();
      onUpdate?.(code);
    } catch (err) {
      setSelected(initialOrigin || null);
      console.error('Error updating origin:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setSelected(null);
    setLoading(true);

    try {
      const res = await fetch('/api/me/origin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setSelected(initialOrigin || null);
        console.error('Failed to clear origin');
        return;
      }

      onUpdate?.(null);
    } catch (err) {
      setSelected(initialOrigin || null);
      console.error('Error clearing origin:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[12px] font-semibold text-fg-2">Origin (Optional)</label>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="w-full rounded-lg border border-line-2 bg-white/5 px-3 py-2 text-left text-[13px] text-fg-1 hover:border-line-1 disabled:opacity-50"
        >
          {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Select a country...'}
        </button>

        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-line-2 bg-ink-900 shadow-lg">
            {COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleSelect(country.code)}
                className="w-full px-3 py-2 text-left text-[12px] hover:bg-line-2 flex items-center gap-2"
              >
                <span className="text-base">{country.flag}</span>
                <span>{country.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <button
          onClick={handleClear}
          disabled={loading}
          className="text-[11px] text-fg-4 hover:text-fg-3 disabled:opacity-50"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
