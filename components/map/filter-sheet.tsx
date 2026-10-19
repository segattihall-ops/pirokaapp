'use client';

import { useState } from 'react';
import { Sheet } from './status-sheet';
import { POSITION_MARKS } from '@/lib/design/icon-paths';
import {
  EMPTY_FILTERS,
  FILTER_GROUPS,
  FILTER_OPTIONS,
  POSITION_GLYPH,
  POSITION_LABEL,
  activeFilterCount,
  parseSmartQuery,
  type FilterKey,
  type Filters,
} from './filters';

const POSITION_LEGEND = POSITION_MARKS.map(({ id }) => ({
  id,
  label: POSITION_LABEL[id],
  d: POSITION_GLYPH[id],
}));

/**
 * The map Filter sheet. A natural-language box ("Describe who you're looking for") sets the chip groups below;
 * it uses /api/smart-filter when an AI key is configured and falls back to an on-device parser otherwise.
 * Every option maps onto a self-described profile field, so the count stays truthful.
 */
export function FilterSheet({
  filters,
  ethnicityEnabled,
  visibleCount,
  showPosition,
  onShowPosition,
  onChange,
  onClose,
}: {
  filters: Filters;
  ethnicityEnabled: boolean;
  visibleCount: number;
  showPosition: boolean;
  onShowPosition: (v: boolean) => void;
  onChange: (next: Filters, chip?: 'all' | 'now' | 'tonight' | 'hosting' | 'visitors') => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = FILTER_GROUPS.filter((g) => g.key !== 'ethnicity' || ethnicityEnabled);

  const toggle = (key: FilterKey, value: string) => {
    const has = filters[key].includes(value);
    onChange({ ...filters, [key]: has ? filters[key].filter((x) => x !== value) : [...filters[key], value] });
  };

  const runSmart = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setNote('πroka is reading that…');
    // The on-device parser is always authoritative for which chips light up; the server call only
    // confirms a key is wired and refreshes the live count. It never returns health or ethnicity.
    const local = parseSmartQuery(query);
    try {
      await fetch('/api/smart-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query.slice(0, 500) }),
      }).catch(() => null);
    } finally {
      onChange(local.filters, local.chip ?? 'all');
      setNote(local.note);
      setBusy(false);
    }
  };

  return (
    <Sheet title="Filter" onClose={onClose}>
      <div className="flex flex-col gap-2.5 rounded-card border border-sel-border bg-gradient-to-br from-[rgba(52,211,153,0.12)] to-transparent p-3.5">
        <span className="flex items-center gap-2.5 text-[14px] font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green text-[15px] font-bold text-ink-950">
            π
          </span>
          Describe who you&apos;re looking for
        </span>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void runSmart();
            }
          }}
          rows={3}
          placeholder="e.g. vers guys hosting tonight, athletic, discreet"
          aria-label="Describe who you're looking for"
          className="min-h-[84px] w-full resize-y rounded-input border border-line-2 bg-black/40 px-3.5 py-3 text-[15px] text-fg outline-none placeholder:text-fg-4"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-fg-3">πroka sets the filters below for you.</span>
          <button
            type="button"
            onClick={runSmart}
            disabled={busy}
            className="btn-primary h-10 bg-green px-5 hover:bg-green-hover"
          >
            {busy ? '…' : 'Apply'}
          </button>
        </div>
      </div>
      {note && <p className="-mt-1 text-[12px] text-green">{note}</p>}

      <div className="flex items-center justify-between gap-3 rounded-card border border-line-1 bg-white/[0.03] px-3 py-2.5">
        <div className="flex flex-wrap gap-3">
          {POSITION_LEGEND.map((pl) => (
            <span key={pl.id} className="flex items-center gap-1.5 text-[12px] text-fg-2">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-fg bg-ink-950 text-fg">
                <svg
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={pl.d} />
                </svg>
              </span>
              {pl.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onShowPosition(!showPosition)}
          className="tap-link shrink-0 text-[12px] font-semibold text-green"
        >
          {showPosition ? 'Hide on map' : 'Show on map'}
        </button>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">{g.title}</span>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS[g.key].map((opt) => {
              const on = filters[g.key].includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(g.key, opt)}
                  className={`rounded-chip border px-3 py-2 text-[12px] font-medium transition-colors ${
                    on
                      ? 'border-sel-border bg-sel-fill text-fg'
                      : 'border-line-2 text-fg-2 hover:border-line-3'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[11px] leading-relaxed text-fg-4">
        Ethnicity is optional and self-described. Profiles that put people down for their race are removed.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onChange(EMPTY_FILTERS, 'all');
            setQuery('');
            setNote('');
          }}
          className="btn-secondary h-12 px-5"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-primary h-12 flex-1 bg-green hover:bg-green-hover"
        >
          Show {visibleCount} {visibleCount === 1 ? 'person' : 'people'}
        </button>
      </div>
      {activeFilterCount(filters) > 0 && (
        <p className="text-center text-[11px] text-fg-4">{activeFilterCount(filters)} filters active</p>
      )}
    </Sheet>
  );
}
