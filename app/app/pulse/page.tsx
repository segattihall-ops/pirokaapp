import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Pulse' };

export default function PulsePage() {
  return (
    <Placeholder
      eyebrow="Pulse"
      title="What’s moving nearby"
      phase="Phase 6"
      spec="Piroka App v2.dc.html → PULSE"
    >
      <div className="grid grid-cols-2 gap-2.5">
        {['Available now', 'Hosting', 'Tonight', 'Visitors'].map((s) => (
          <div key={s} className="glass rounded-card p-4">
            <div className="text-[26px] font-semibold tracking-[-0.03em]">—</div>
            <div className="text-[12px] text-fg-3">{s}</div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
