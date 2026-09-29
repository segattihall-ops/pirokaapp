'use client';

import { useState } from 'react';

const POSITIONS = [
  'top',
  'versatile',
  'bottom',
  'prefer_not_to_say',
];

const POSITION_LABELS: Record<string, { label: string; emoji: string }> = {
  top: { label: 'Top', emoji: '📍' },
  versatile: { label: 'Versatile', emoji: '🔄' },
  bottom: { label: 'Bottom', emoji: '📍' },
  prefer_not_to_say: { label: 'Prefer Not to Say', emoji: '❓' },
};

interface PositionSelectorProps {
  selected?: string | null;
  onSelect?: (position: string | null) => void;
}

/**
 * Position mark selector
 * Shows as emoji/mark on profile and map
 * Helps filter and match
 * Optional field
 */
export function PositionSelector({ selected, onSelect }: PositionSelectorProps) {
  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <h3 className="text-[14px] font-bold text-white">Sexual Position</h3>

      <div className="grid grid-cols-2 gap-2">
        {POSITIONS.map(position => (
          <button
            key={position}
            onClick={() => onSelect?.(position === selected ? null : position)}
            className={`p-3 rounded-lg text-center text-[12px] font-semibold transition-colors ${
              selected === position
                ? 'bg-green text-ink-950 border border-green'
                : 'bg-white/10 text-white border border-line-2 hover:bg-white/20'
            }`}
          >
            <div className="text-[20px] mb-1">{POSITION_LABELS[position].emoji}</div>
            <div>{POSITION_LABELS[position].label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
