/**
 * Small, dependency-free charts for the admin console (server-renderable SVG).
 * Palette validated for the dark surface: green #0ea371, amber #c2680a, indigo #5b5fe8.
 * Single-series bars carry no legend (the title names the series); multi-series show one.
 */

export const CHART_COLORS = { green: '#0ea371', amber: '#c2680a', indigo: '#5b5fe8' } as const;

export type Point = { label: string; value: number };

export function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number | null;
}) {
  const up = (delta ?? 0) > 0;
  return (
    <div className="glass rounded-card px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">{label}</p>
      <p className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {delta !== undefined && delta !== null && (
        <p className={`text-[11px] ${up ? 'text-green' : delta < 0 ? 'text-danger' : 'text-fg-4'}`}>
          {up ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta).toLocaleString()} vs prior period
        </p>
      )}
      {hint && <p className="text-[11px] text-fg-4">{hint}</p>}
    </div>
  );
}

/** Single-series bar chart with per-bar hover tooltip (native <title>) and sparse axis labels. */
export function Bars({
  title,
  data,
  color = CHART_COLORS.green,
  height = 140,
  format = (n: number) => n.toLocaleString(),
}: {
  title: string;
  data: Point[];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const w = 600;
  const padL = 36;
  const padB = 22;
  const padT = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (w - padL) / n;
  const barW = Math.max(2, slot - 2);
  const plotH = height - padB - padT;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(n / 6);
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <figure className="glass rounded-card px-4 py-3.5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="text-[12px] text-fg-3">{format(total)} total</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}
        className="mt-2 h-auto w-full"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={w}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <text x={padL - 6} y={y(max * t) + 4} textAnchor="end" fontSize={10} fill="#8a8a8a">
              {format(Math.round(max * t))}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + 1;
          const top = y(d.value);
          const h = Math.max(d.value > 0 ? 2 : 0, padT + plotH - top);
          return (
            <g key={d.label + i}>
              <rect x={x} y={top} width={barW} height={h} rx={Math.min(4, barW / 2)} fill={color}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              {/* larger hit target than the bar itself */}
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent">
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#8a8a8a">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Horizontal funnel: each stage as a bar relative to the first, with conversion labels. */
export function Funnel({ title, stages }: { title: string; stages: Point[] }) {
  const first = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="glass rounded-card px-4 py-3.5">
      <p className="text-[13px] font-semibold">{title}</p>
      <ol className="mt-3 flex flex-col gap-2">
        {stages.map((s, i) => {
          const pct = Math.round((s.value / first) * 100);
          const prev = i === 0 ? null : Math.round((s.value / Math.max(1, stages[i - 1].value)) * 100);
          return (
            <li key={s.label} className="flex items-center gap-3 text-[12px]">
              <span className="w-[120px] shrink-0 truncate text-fg-2">{s.label}</span>
              <span
                className="h-5 flex-1 rounded bg-white/[0.05]"
                title={`${s.label}: ${s.value.toLocaleString()}`}
              >
                <span
                  className="block h-full rounded"
                  style={{ width: `${Math.max(1, pct)}%`, background: CHART_COLORS.green }}
                />
              </span>
              <span className="w-[112px] shrink-0 text-right text-fg-3">
                {s.value.toLocaleString()} · {pct}%{prev !== null ? ` (${prev}% step)` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Legend row for multi-series tables (plan mix etc.). */
export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="text-fg-3">· {i.value}</span>}
        </li>
      ))}
    </ul>
  );
}
