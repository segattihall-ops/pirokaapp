'use client';

import { useEffect, useState } from 'react';

type Cell = { lat: number; lon: number; count: number };

/** Live density around the member — real current hotspots, not a stored/empty table. */
export function ActivityHeatmap({ lat, lon }: { lat: number; lon: number }) {
  const [cells, setCells] = useState<Cell[] | null>(null);

  useEffect(() => {
    fetch(`/api/pulse/heatmap?lat=${lat}&lon=${lon}&radius=25000`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { cells: [] }))
      .then((j) => setCells(j.cells ?? []))
      .catch(() => setCells([]));
  }, [lat, lon]);

  if (cells === null) {
    return <div className="text-center text-[13px] text-fg-3">Loading activity heatmap…</div>;
  }
  if (cells.length === 0) {
    return (
      <div className="text-center text-[13px] text-fg-3">
        No clusters active near you right now. Hotspots appear where 3+ people gather.
      </div>
    );
  }

  const max = Math.max(...cells.map((c) => c.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-fg-3">ACTIVITY HOTSPOTS</span>
        <span className="text-[11px] text-fg-4">Live · within 25 mi</span>
      </div>
      <div className="grid max-h-[300px] gap-2 overflow-y-auto">
        {cells.map((c, i) => {
          const share = c.count / max;
          return (
            <div
              key={`${c.lat},${c.lon},${i}`}
              className="glass flex items-center gap-3 rounded-card px-3 py-2"
            >
              <div className="flex-1">
                <span className="text-[13px] font-semibold text-fg">{c.count} active</span>
                <span className="ml-2 text-[11px] text-fg-4">
                  {share >= 0.75 ? 'Packed' : share >= 0.4 ? 'Busy' : 'Lively'}
                </span>
              </div>
              <div
                className="h-6 w-10 rounded-input border border-line-1"
                style={{ background: `rgba(52, 211, 153, ${Math.max(0.12, share)})` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
