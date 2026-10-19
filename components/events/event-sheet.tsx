'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sheet } from '@/components/map/status-sheet';
import { CATEGORY_LABEL, type EventCategory } from '@/lib/events/types';

interface EventSheetProps {
  lat: number;
  lon: number;
  locationName: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: EventCategory[] = ['party', 'meetup', 'sports', 'cultural', 'nightlife', 'other'];

export default function EventSheet({ lat, lon, locationName, onClose, onCreated }: EventSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('meetup');
  const [where, setWhere] = useState(locationName);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || undefined,
          location: { lat, lon },
          locationName: where,
          startsAt,
          endsAt,
          category,
          maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || 'Could not create the event');
      return res.json();
    },
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  const disabled = !title.trim() || !where.trim() || !startsAt || !endsAt || create.isPending;

  return (
    <Sheet title="Create an event" onClose={onClose}>
      <p className="-mt-2 text-[13px] text-fg-3">
        It&apos;s pinned at your current position and shows up for people nearby. Names of who&apos;s going
        stay private.
      </p>

      <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Underwear night at The Loft"
          maxLength={200}
          className="input h-12 font-normal text-fg"
        />
      </label>

      <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
        About <span className="font-normal text-fg-4">(optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's happening, dress code, cover…"
          maxLength={2000}
          rows={3}
          className="input min-h-[72px] py-2 font-normal text-fg"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-fg-3">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`chip ${category === c ? 'chip-selected' : ''}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
        Where
        <input
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="Venue or area name"
          maxLength={160}
          className="input h-12 font-normal text-fg"
        />
      </label>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[12px] font-semibold text-fg-3">
          Starts
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="input h-12 font-normal text-fg"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[12px] font-semibold text-fg-3">
          Ends
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="input h-12 font-normal text-fg"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[12px] font-semibold text-fg-3">
        Max attendees <span className="font-normal text-fg-4">(optional)</span>
        <input
          type="number"
          value={maxAttendees}
          onChange={(e) => setMaxAttendees(e.target.value)}
          placeholder="Leave blank for unlimited"
          min="1"
          className="input h-12 font-normal text-fg"
        />
      </label>

      {create.isError && (
        <p role="alert" className="text-[12px] text-danger">
          {String(create.error instanceof Error ? create.error.message : create.error)}
        </p>
      )}

      <button
        type="button"
        onClick={() => create.mutate()}
        disabled={disabled}
        className="btn-primary h-12 bg-green hover:bg-green-hover"
      >
        {create.isPending ? '…' : 'Create event'}
      </button>
    </Sheet>
  );
}
