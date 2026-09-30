'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateGroupProps {
  initialLat: number;
  initialLng: number;
  initialLocationName: string;
  onSuccess?: () => void;
}

export function CreateGroupForm({ initialLat, initialLng, initialLocationName, onSuccess }: CreateGroupProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          photo: photo || undefined,
          location: { lat: initialLat, lng: initialLng },
          location_name: initialLocationName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create group');
        return;
      }

      const group = await res.json();
      if (onSuccess) onSuccess();
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-4">
      <div>
        <label className="text-[12px] font-semibold text-fg-2">Group name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Hiking enthusiasts"
          maxLength={100}
          required
          className="w-full mt-2 p-3 rounded-lg border border-line-2 bg-white/5 text-white text-[14px] placeholder-fg-4 focus:border-green focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-fg-2">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this group about?"
          maxLength={500}
          className="w-full mt-2 p-3 rounded-lg border border-line-2 bg-white/5 text-white text-[14px] placeholder-fg-4 focus:border-green focus:outline-none resize-none"
          rows={2}
        />
        <p className="text-[10px] text-fg-4 mt-1">{description.length}/500</p>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-fg-2">Photo URL (optional)</label>
        <input
          type="url"
          value={photo}
          onChange={e => setPhoto(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="w-full mt-2 p-3 rounded-lg border border-line-2 bg-white/5 text-white text-[14px] placeholder-fg-4 focus:border-green focus:outline-none"
        />
      </div>

      <div className="text-[12px] text-fg-4">Location: {initialLocationName}</div>

      {error && <div className="p-2 rounded bg-red-400/20 text-red-300 text-[12px]">{error}</div>}

      <button
        type="submit"
        disabled={!name.trim() || loading}
        className="w-full py-2 rounded-lg bg-green text-ink-950 font-medium disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Group'}
      </button>
    </form>
  );
}
