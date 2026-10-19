'use client';

import { useEffect, useState } from 'react';

type Point = { bucket: string; active: number };

/** Real hourly activity for the member's area, from the snapshot cron. Never fabricated. */
export function ActivityTrends({ lat, lon }: { lat: number; lon: number }) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    fetch(`/api/pulse/trends?lat=${lat}&lon=${lon}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((j) => setPoints(j.points ?? []))
      .catch(() => setPoints([]));
  }, [lat, lon]);

  if (points === null) {
    return <div className="text-center text-[13px] text-fg-3">Loading trends…</div>;
  }
  if (points.length < 2) {
    return (
      <div className="text-center text-[13px] text-fg-3">
        Collecting activity for your area — the curve fills in over the next hours. Check back soon.
      </div>
    );
  }

  const max = Math.max(...points.map((p) => p.active), 1);
  const peak = points.reduce((a, b) => (b.active > a.active ? b : a));
  const peakHour = new Date(peak.bucket).toLocaleTimeString([], { hour: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-fg-3">ACTIVE MEMBERS · LAST 24H</span>
        <span className="text-[11px] text-fg-4">
          Peak {peak.active} · {peakHour}
        </span>
      </div>
      <div className="flex h-[140px] items-end gap-1">
        {points.map((p) => {
          const h = Math.max(4, Math.round((p.active / max) * 132));
          const hour = new Date(p.bucket).getHours();
          return (
            <div
              key={p.bucket}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${p.active} active`}
            >
              <div
                className="w-full rounded-t-[4px] bg-green"
                style={{ height: `${h}px`, opacity: p.active === max ? 1 : 0.55 }}
              />
              {hour % 6 === 0 && <span className="text-[9px] text-fg-4">{hour}h</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
