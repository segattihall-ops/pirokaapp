'use client';

import type { Visitor } from '@/app/api/nearby/route';
import { UserRow } from '@/components/people/user-row';
import { Sheet } from './status-sheet';

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** People who announced a trip to the area you are looking at. */
export function VisitorsSheet({ visitors, onOpen, onClose }: { visitors: Visitor[]; onOpen: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Visiting soon" onClose={onClose}>
      {visitors.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-fg-3">Nobody has announced a trip here yet.</p>
      ) : (
        <div className="flex flex-col">
          {visitors.map((v) => (
            <UserRow
              key={v.id}
              user={{ id: v.id, handle: v.handle, photo: v.photo, verified: false }}
              sub={`${v.city.split(',')[0]} · ${fmt(v.arriveOn)} · ${v.nights} night${v.nights === 1 ? '' : 's'}`}
              onOpen={() => onOpen(v.id)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
