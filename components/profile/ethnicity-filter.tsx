'use client';

import { useState } from 'react';

const ETHNICITIES = [
  'South Asian',
  'East Asian',
  'Southeast Asian',
  'Middle Eastern',
  'North African',
  'Sub-Saharan African',
  'Caribbean',
  'Latin American',
  'European',
  'White',
  'Indigenous',
  'Mixed',
  'Prefer not to say',
];

interface EthnicityFilterProps {
  selected?: string[];
  onSelect?: (ethnicities: string[]) => void;
}

/**
 * Ethnicity filter (feature-flagged)
 * Visible only when user has explicitly enabled it
 * Respects privacy by making it optional
 * Part of preference system
 */
export function EthnicityFilter({ selected = [], onSelect }: EthnicityFilterProps) {
  const [open, setOpen] = useState(false);

  const toggle = (ethnicity: string) => {
    const updated = selected.includes(ethnicity)
      ? selected.filter(e => e !== ethnicity)
      : [...selected, ethnicity];
    onSelect?.(updated);
  };

  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between text-[14px] font-bold text-white hover:text-green transition-colors"
      >
        <span>Ethnicity Preferences</span>
        <span>{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2">
          {ETHNICITIES.map(ethnicity => (
            <button
              key={ethnicity}
              onClick={() => toggle(ethnicity)}
              className={`p-2 rounded text-[12px] font-semibold transition-colors ${
                selected.includes(ethnicity)
                  ? 'bg-green text-ink-950'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {ethnicity}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
