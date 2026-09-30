'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CATEGORY_LABEL, type EventCategory } from '@/lib/events/types';

interface EventSheetProps {
  lat: number;
  lon: number;
  locationName: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function EventSheet({ lat, lon, locationName, onClose, onCreated }: EventSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>('meetup');
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
          locationName,
          startsAt,
          endsAt,
          category,
          maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  const disabled = !title || !startsAt || !endsAt || create.isPending;
  const categories: EventCategory[] = ['party', 'meetup', 'sports', 'cultural', 'nightlife', 'other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-gray-950 p-6">
        <h2 className="mb-4 text-lg font-semibold">Create Event</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Party at The Loft"
              maxLength={200}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening..."
              maxLength={2000}
              rows={2}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as EventCategory)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400">Starts *</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">Ends *</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Location</label>
            <input type="text" value={locationName} disabled className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm opacity-50" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Max Attendees (optional)</label>
            <input
              type="number"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              placeholder="Leave blank for unlimited"
              min="1"
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={disabled}
            className="flex-1 rounded bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>

        {create.isError && (
          <div className="mt-3 rounded bg-red-900/30 px-3 py-2 text-xs text-red-400">{String(create.error)}</div>
        )}
      </div>
    </div>
  );
}
