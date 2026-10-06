'use client';

import { useEffect, useState } from 'react';

interface HeatmapPoint {
  location: { x: number; y: number };
  active_profiles: number;
  activity_score: number;
  trend: 'rising' | 'stable' | 'falling';
}

export function ActivityHeatmap({ city, onDataLoad }: { city: string; onDataLoad?: (points: HeatmapPoint[]) => void }) {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxActivity, setMaxActivity] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pulse/heatmap?city=${encodeURIComponent(city)}&radius=25000`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setPoints(data.hotspots || []);
          setMaxActivity(Math.max(...(data.hotspots?.map((p: HeatmapPoint) => p.activity_score) || [0])));
          onDataLoad?.(data.hotspots || []);
        }
      } catch (err) {
        console.error('Failed to load heatmap:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [city, onDataLoad]);

  if (loading) {
    return <div className="text-center text-[13px] text-fg-3">Loading activity heatmap…</div>;
  }

  if (points.length === 0) {
    return <div className="text-center text-[13px] text-fg-3">No activity data for this area yet.</div>;
  }

  const trendColor: Record<string, string> = {
    rising: 'text-green',
    stable: 'text-fg-3',
    falling: 'text-amber-400',
  };

  const trendLabel: Record<string, string> = {
    rising: '📈',
    stable: '→',
    falling: '📉',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-fg-3">ACTIVITY HOTSPOTS</span>
        <span className="text-[11px] text-fg-4">Last hour</span>
      </div>
      <div className="grid max-h-[300px] overflow-y-auto gap-2">
        {points.map((p, i) => (
          <div key={i} className="glass flex items-center gap-3 rounded-card px-3 py-2">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-fg">{Math.round(p.activity_score * 100)}%</span>
                <span className={`text-[12px] ${trendColor[p.trend]}`}>{trendLabel[p.trend]}</span>
              </div>
              <span className="text-[11px] text-fg-4">{p.active_profiles} people active</span>
            </div>
            <div
              className="h-6 w-10 rounded-lg border border-line-1"
              style={{
                background: `rgba(34, 197, 94, ${Math.min(p.activity_score, 1)})`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
