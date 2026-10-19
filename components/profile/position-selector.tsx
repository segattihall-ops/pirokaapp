'use client';

import { POSITION_MARKS, canonicalPositionMark } from '@/lib/design/icon-paths';

interface PositionSelectorProps {
  selected?: string | null;
  onSelect?: (position: string | null) => void;
}

/** The same seven semantic glyphs from App v2, without emoji. */
export function PositionSelector({ selected, onSelect }: PositionSelectorProps) {
  const current = selected ? canonicalPositionMark(selected) : null;

  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <h3 className="text-[14px] font-semibold text-fg">Position</h3>
      <div className="grid grid-cols-2 gap-2">
        {POSITION_MARKS.map((position) => (
          <button
            key={position.id}
            type="button"
            aria-pressed={current === position.id}
            onClick={() => onSelect?.(current === position.id ? null : position.id)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-btn border p-3 text-center text-[12px] font-semibold transition-colors ${
              current === position.id
                ? 'border-sel-border bg-sel-fill text-green'
                : 'border-line-2 bg-ink-850 text-fg-2 hover:border-line-3'
            }`}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={position.path} />
            </svg>
            <span>{position.label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!current}
          onClick={() => onSelect?.(null)}
          className={`min-h-11 rounded-btn border p-3 text-[12px] font-semibold ${
            !current ? 'border-sel-border bg-sel-fill text-green' : 'border-line-2 bg-ink-850 text-fg-2'
          }`}
        >
          Prefer not to say
        </button>
      </div>
    </div>
  );
}
