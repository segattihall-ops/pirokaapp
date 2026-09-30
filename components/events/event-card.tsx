'use client';

import { useMutation } from '@tanstack/react-query';
import { CATEGORY_LABEL, type Event, type RSVPStatus } from '@/lib/events/types';

interface EventCardProps {
  event: Event;
  onRsvp?: (status: RSVPStatus) => void;
}

export default function EventCard({ event, onRsvp }: EventCardProps) {
  const startDate = new Date(event.starts_at);
  const endDate = new Date(event.ends_at);
  const now = new Date();

  const rsvp = useMutation({
    mutationFn: async (status: RSVPStatus) => {
      const res = await fetch(`/api/events/${event.id}/attend`, {
        method: event.my_rsvp_status ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      onRsvp?.(event.my_rsvp_status as RSVPStatus);
    },
  });

  const unrsvp = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${event.id}/attend`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const isPast = endDate < now;
  const isToday = startDate.toDateString() === now.toDateString();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      {event.photo && <img src={event.photo} alt={event.title} className="aspect-video w-full object-cover" />}

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="line-clamp-2 text-base font-semibold">{event.title}</h3>
          <span className="text-xs font-medium text-gray-400">{CATEGORY_LABEL[event.category]}</span>
        </div>

        <p className="mb-3 text-xs text-gray-400">{event.location_name}</p>

        <div className="mb-3 space-y-1 text-xs text-gray-400">
          <div>
            📅{' '}
            {isToday ? 'Today' : startDate.toLocaleDateString()} at{' '}
            {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div>👥 {event.attendee_count || 0} going{event.max_attendees ? ` / ${event.max_attendees}` : ''}</div>
        </div>

        {event.description && (
          <p className="mb-3 line-clamp-2 text-xs text-gray-300">{event.description}</p>
        )}

        {!isPast && (
          <div className="flex gap-2">
            {event.my_rsvp_status ? (
              <>
                <button
                  onClick={() => unrsvp.mutate()}
                  className="flex-1 rounded border border-gray-600 px-2 py-1.5 text-xs font-medium hover:bg-gray-800"
                  disabled={unrsvp.isPending}
                >
                  Not Going
                </button>
                <button
                  onClick={() => rsvp.mutate('going')}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${
                    event.my_rsvp_status === 'going'
                      ? 'bg-emerald-600'
                      : 'border border-emerald-600 text-emerald-400 hover:bg-emerald-900/30'
                  }`}
                  disabled={rsvp.isPending}
                >
                  Going
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => rsvp.mutate('interested')}
                  className="flex-1 rounded border border-gray-600 px-2 py-1.5 text-xs font-medium hover:bg-gray-800"
                  disabled={rsvp.isPending}
                >
                  Interested
                </button>
                <button
                  onClick={() => rsvp.mutate('going')}
                  className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium hover:bg-emerald-700"
                  disabled={rsvp.isPending}
                >
                  Going
                </button>
              </>
            )}
          </div>
        )}

        {isPast && <div className="text-xs text-gray-500">Event has ended</div>}
      </div>
    </div>
  );
}
