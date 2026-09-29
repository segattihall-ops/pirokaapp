'use client';

import { useState } from 'react';

interface Event {
  id: string;
  name: string;
  startsAt: Date;
  endsAt?: Date;
  placeId?: string;
  groupId?: string;
  rsvps: number;
}

interface EventsSheetProps {
  events: Event[];
  onRsvp?: (eventId: string) => void;
}

/**
 * Events sheet showing upcoming events within user's area
 * Sorted by start time and distance
 * RSVP tracks attendance
 */
export function EventsSheet({ events, onRsvp }: EventsSheetProps) {
  const [rsvpd, setRsvpd] = useState<Set<string>>(new Set());

  const handleRsvp = (eventId: string) => {
    setRsvpd(prev => new Set([...prev, eventId]));
    onRsvp?.(eventId);
  };

  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <h3 className="text-[15px] font-semibold text-white">Events Today</h3>

      {events.length === 0 ? (
        <div className="text-center py-8 text-fg-3">
          <p className="text-sm">No events nearby</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div
              key={event.id}
              className="flex items-center justify-between rounded-lg border border-line-2 bg-white/[0.04] p-3 hover:border-green hover:bg-white/[0.08] transition-colors"
            >
              <div>
                <p className="text-[14px] font-medium text-white">{event.name}</p>
                <p className="text-[12px] text-fg-3">
                  {event.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {event.rsvps > 0 && ` • ${event.rsvps} going`}
                </p>
              </div>
              <button
                onClick={() => handleRsvp(event.id)}
                className={`px-3 py-1.5 rounded-chip text-[12px] font-medium transition-colors ${
                  rsvpd.has(event.id)
                    ? 'bg-green text-ink-950'
                    : 'border border-line-2 bg-white/5 text-fg hover:border-green'
                }`}
              >
                {rsvpd.has(event.id) ? 'Going' : 'RSVP'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
