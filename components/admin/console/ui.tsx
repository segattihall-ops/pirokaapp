'use client';

import type { ReactNode } from 'react';

// Every value here is a design token (design_handoff/DESIGN_TOKENS.md): ink-850 cards with a line-1 hairline.
const CARD = 'rounded-card border border-line-1 bg-ink-850';

/** Page header: title + subtitle, with an optional search box (right-aligned), matching the prototype. */
export function ConsoleHeader({
  title,
  sub,
  search,
  q,
  onQ,
  demo,
}: {
  title: string;
  sub: string;
  search?: boolean;
  q?: string;
  onQ?: (v: string) => void;
  demo?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2.5">
          <span className="text-[26px] font-semibold tracking-[-0.03em]">{title}</span>
          {demo && (
            <span className="rounded-chip border border-warning/40 bg-warning/10 px-2 py-0.5 text-eyebrow text-warning">
              Demo data
            </span>
          )}
        </span>
        <span className="text-[13px] text-fg-3">{sub}</span>
      </span>
      {search && (
        <input
          value={q ?? ''}
          onChange={(e) => onQ?.(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className="h-10 w-[260px] max-w-full rounded-input border border-line-2 bg-ink-850 px-3 text-[13px] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border"
        />
      )}
    </div>
  );
}

export type Filter = { key: string; label: string; n: number };

export function FilterChips({
  filters,
  active,
  onPick,
}: {
  filters: Filter[];
  active: string;
  onPick: (key: string) => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.map((f) => {
        const on = active === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onPick(f.key)}
            className={`h-8 rounded-chip border px-3 text-[12px] font-medium text-fg ${
              on ? 'border-sel-border bg-sel-fill' : 'border-line-2 bg-transparent'
            }`}
          >
            {f.label} <span className="text-fg-3">{f.n}</span>
          </button>
        );
      })}
    </div>
  );
}

export type QueueRow = {
  id: string;
  dot: string;
  title: string;
  meta: string;
  tag: string;
  tagCol: string;
};

/** The list + detail two-column layout the prototype uses for every moderation queue. */
export function QueueLayout({
  rows,
  selectedId,
  onSelect,
  detail,
  emptyLabel = 'Queue is clear.',
}: {
  rows: QueueRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  detail: ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className={`flex flex-col overflow-hidden ${CARD}`}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}
            className={`flex items-center gap-3 border-b border-line-1 px-3.5 py-3 text-left last:border-b-0 ${
              selectedId === r.id ? 'bg-ink-750' : 'bg-transparent'
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-chip" style={{ background: r.dot }} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[13px] font-semibold">{r.title}</span>
              <span className="truncate text-[12px] text-fg-3">{r.meta}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-[3px]">
              <span className="font-mono text-[11px] text-fg-4">{r.id}</span>
              <span className="text-[11px]" style={{ color: r.tagCol }}>
                {r.tag}
              </span>
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-fg-4">{emptyLabel}</div>
        )}
      </div>

      <div className={`sticky top-5 flex flex-col gap-3.5 p-[18px] ${CARD}`}>{detail}</div>
    </div>
  );
}

export function NoSelection({ label = 'Select an item to review.' }: { label?: string }) {
  return <span className="py-[30px] text-center text-[13px] text-fg-4">{label}</span>;
}

export function DetailHead({ title, id }: { title: string; id: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2.5">
      <span className="text-[18px] font-semibold tracking-[-0.02em]">{title}</span>
      <span className="font-mono text-[12px] text-fg-3">{id}</span>
    </div>
  );
}

export function Facts({ items }: { items: { k: string; v: string }[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
      {items.map((f) => (
        <div key={f.k} className="flex flex-col gap-[3px] rounded-input bg-ink-800 px-3 py-2.5">
          <span className="text-[11px] text-fg-4">{f.k}</span>
          <span className="text-[13px]">{f.v}</span>
        </div>
      ))}
    </div>
  );
}

export function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-input border border-line-1 bg-ink-800 px-3.5 py-3">
      <span className="text-[11px] text-fg-4">{label}</span>
      {children}
    </div>
  );
}

export type ActionKind = 'pri' | 'danger' | 'default';

export function Action({
  label,
  onClick,
  kind = 'default',
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  kind?: ActionKind;
  disabled?: boolean;
  title?: string;
}) {
  // Primary / outline / destructive, per the tokens' button rules (14px radius, 44px tall).
  const look =
    kind === 'pri'
      ? 'border-green bg-green text-ink-950'
      : kind === 'danger'
        ? 'border-danger/60 bg-danger/10 text-danger'
        : 'border-line-3 bg-transparent text-fg';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-11 rounded-btn border px-3.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${look}`}
    >
      {label}
    </button>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function Warn({ children }: { children: ReactNode }) {
  return <span className="text-[12px] text-warning">{children}</span>;
}

export function NoteBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      placeholder={placeholder}
      className="resize-y rounded-input border border-line-2 bg-ink-800 px-3 py-2.5 text-[13px] leading-[1.5] text-fg outline-none placeholder:text-fg-4 focus:border-sel-border"
    />
  );
}
