import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Chats' };

export default function ChatsPage() {
  return (
    <Placeholder eyebrow="Chats" title="Smart inbox" phase="Phase 4" spec="Piroka App v2.dc.html → CHATS">
      <div className="flex flex-col gap-1.5">
        {['NOW', 'MUTUAL', 'ACTIVE', 'LATER', 'EXPIRED'].map((b) => (
          <div
            key={b}
            className="flex items-center justify-between rounded-input border border-line-1 bg-ink-900 px-4 py-3"
          >
            <span className="text-[11px] font-bold tracking-[0.14em] text-fg-3">{b}</span>
            <span className="text-[12px] text-fg-4">0</span>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
