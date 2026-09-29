import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Places' };

export default function PlacesPage() {
  return (
    <Placeholder
      eyebrow="Places"
      title="Places · Events · Groups · Testing"
      phase="Phase 6"
      spec="Piroka App v2.dc.html → PLACES"
    >
      <div className="flex gap-2">
        {['Places', 'Events', 'Groups', 'Testing'].map((t, i) => (
          <span key={t} className={`chip ${i === 0 ? 'chip-selected' : ''}`}>
            {t}
          </span>
        ))}
      </div>
    </Placeholder>
  );
}
