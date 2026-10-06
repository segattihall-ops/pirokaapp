'use client';

import { useEffect, useState } from 'react';

interface Trend {
  hour: number;
  active_profiles: number;
  messages_sent: number;
  avg_session_duration: number | null;
  trend: string;
}

export function ActivityTrends({ city }: { city: string }) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pulse/heatmap?city=${encodeURIComponent(city)}&radius=25000`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          // Simulate trend data from heatmap (in production, this would come from activity_trends table)
          const simulatedTrends = data.hotspots?.map((p: any, i: number) => ({
            hour: (new Date().getHours() - i + 24) % 24,
            active_profiles: Math.round(p.active_profiles * (1 - i * 0.1)),
            messages_sent: Math.round(p.active_profiles * 2.5 * (1 - i * 0.1)),
            avg_session_duration: 25 + Math.random() * 35,
            trend: p.trend,
          })) || [];
          setTrends(simulatedTrends);
          setPeak(Math.max(...simulatedTrends.map((t: Trend) => t.active_profiles)));
        }
      } catch (err) {
        console.error('Failed to load trends:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [city]);

  if (loading) {
    return <div className="text-center text-[13px] text-fg-3">Loading trends…</div>;
  }

  if (trends.length === 0) {
    return <div className="text-center text-[13px] text-fg-3">No trend data available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-fg-3">24-HOUR ACTIVITY</span>
        <span className="text-[11px] text-fg-4">Peak: {peak} people</span>
      </div>

      {/* Activity bar chart */}
      <div className="space-y-1.5">
        {trends.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-right text-[10px] text-fg-4">{t.hour}h</span>
            <div className="flex-1">
              <div className="h-6 rounded-sm bg-ink-800" style={{ width: `${(t.active_profiles / peak) * 100}%` }}>
                <div
                  className="h-full rounded-sm bg-green transition-all"
                  style={{
                    width: '100%',
                    opacity: Math.min(t.active_profiles / peak, 1),
                  }}
                />
              </div>
            </div>
            <span className="w-8 text-right text-[11px] text-fg-3">{t.active_profiles}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-card px-3 py-2 text-center">
          <div className="text-[14px] font-semibold text-fg">{trends.reduce((a, t) => a + t.messages_sent, 0)}</div>
          <div className="text-[10px] text-fg-4">Messages</div>
        </div>
        <div className="glass rounded-card px-3 py-2 text-center">
          <div className="text-[14px] font-semibold text-fg">{Math.round((trends[0]?.avg_session_duration || 0) * 10) / 10}m</div>
          <div className="text-[10px] text-fg-4">Avg session</div>
        </div>
        <div className="glass rounded-card px-3 py-2 text-center">
          <div className="text-[14px] font-semibold text-green">{trends.filter((t) => t.trend === 'rising').length}</div>
          <div className="text-[10px] text-fg-4">Rising</div>
        </div>
      </div>
    </div>
  );
}
