'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CATEGORY_LABEL, type Event, type RSVPStatus } from '@/lib/events/types';

interface EventCardProps {
  event: Event;
  onRsvp?: (status: RSVPStatus | null) => void;
}

const icon = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 14,
  height: 14,
  'aria-hidden': true,
};

export default function EventCard({ event, onRsvp }: EventCardProps) {
  const startDate = new Date(event.starts_at);
  const endDate = new Date(event.ends_at);
  const now = new Date();
  const [err, setErr] = useState<string | null>(null);

  const call = async (method: 'POST' | 'PATCH' | 'DELETE', status?: RSVPStatus) => {
    const res = await fetch(`/api/events/${event.id}/attend`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: status ? JSON.stringify({ status }) : undefined,
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(j?.error ?? 'Could not update your RSVP');
    }
    return res.json();
  };

  const rsvp = useMutation({
    mutationFn: (status: RSVPStatus) => call(event.my_rsvp_status ? 'PATCH' : 'POST', status),
    onMutate: () => setErr(null),
    onSuccess: (_d, status) => onRsvp?.(status),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Could not update your RSVP'),
  });

  const unrsvp = useMutation({
    mutationFn: () => call('DELETE'),
    onMutate: () => setErr(null),
    onSuccess: () => onRsvp?.(null),
    onError: (e) => setErr(e instanceof Error ? e.message : 'Could not update your RSVP'),
  });

  const isPast = endDate < now;
  const isToday = startDate.toDateString() === now.toDateString();
  const busy = rsvp.isPending || unrsvp.isPending;
  const going = event.my_rsvp_status === 'going';

  return (
    <article className="glass overflow-hidden rounded-card border border-line-1">
      {event.photo && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image src={event.photo} alt={event.title} fill className="object-cover" />
        </div>
      )}

      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-semibold text-fg">{event.title}</h3>
          <span className="chip shrink-0 text-[11px]">{CATEGORY_LABEL[event.category]}</span>
        </div>

        <p className="text-[12px] text-fg-3">{event.location_name}</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" {...icon}>
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {isToday ? 'Today' : startDate.toLocaleDateString()} ·{' '}
            {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" {...icon}>
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 6M20.5 19a5 5 0 0 0-4-4.8" />
            </svg>
            {event.attendee_count || 0} going{event.max_attendees ? ` / ${event.max_attendees}` : ''}
          </span>
        </div>

        {event.description && (
          <p className="line-clamp-2 text-[13px] leading-[1.5] text-fg-2">{event.description}</p>
        )}

        {!isPast && (
          <div className="mt-1 flex gap-2">
            {event.my_rsvp_status ? (
              <>
                <button
                  type="button"
                  onClick={() => unrsvp.mutate()}
                  disabled={busy}
                  className="tap h-10 flex-1 rounded-btn border border-line-3 text-[13px] font-medium text-fg disabled:opacity-40"
                >
                  Not going
                </button>
                <button
                  type="button"
                  onClick={() => rsvp.mutate('going')}
                  disabled={busy || going}
                  aria-pressed={going}
                  className={`tap h-10 flex-1 rounded-btn text-[13px] font-semibold disabled:opacity-60 ${
                    going ? 'bg-green text-ink-950' : 'border border-sel-border bg-sel-fill text-green'
                  }`}
                >
                  {going ? 'Going' : 'Going'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => rsvp.mutate('interested')}
                  disabled={busy}
                  className="tap h-10 flex-1 rounded-btn border border-line-3 text-[13px] font-medium text-fg disabled:opacity-40"
                >
                  Interested
                </button>
                <button
                  type="button"
                  onClick={() => rsvp.mutate('going')}
                  disabled={busy}
                  className="tap h-10 flex-1 rounded-btn bg-green text-[13px] font-semibold text-ink-950 disabled:opacity-40"
                >
                  Going
                </button>
              </>
            )}
          </div>
        )}
        {err && (
          <p role="alert" className="text-[12px] text-danger">
            {err}
          </p>
        )}
        {isPast && <p className="text-[12px] text-fg-4">Event has ended</p>}
      </div>
    </article>
  );
}
