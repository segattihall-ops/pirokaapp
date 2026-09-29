import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Me' };

export default function MePage() {
  return (
    <Placeholder eyebrow="Me" title="Your profile" phase="Phases 2, 5, 8" spec="Piroka App v2.dc.html → ME">
      <div className="flex flex-col gap-2">
        {['PIROKA Mode', 'Trust signals', 'SafeMeet', 'Trips', 'Your album', 'Privacy & safety'].map((s) => (
          <div
            key={s}
            className="glass flex items-center justify-between rounded-card px-4 py-3.5 text-[14px] font-medium"
          >
            {s}
            <span className="text-fg-4">›</span>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
