'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
  description?: string;
  location_name: string;
  members_count: number;
  photo?: string;
}

interface GroupsListProps {
  lat: number;
  lng: number;
  radius?: number;
}

export function GroupsList({ lat, lng, radius = 50 }: GroupsListProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch(`/api/groups?lat=${lat}&lng=${lng}&radius=${radius}`);
        if (res.ok) {
          const data = await res.json();
          setGroups(data.groups);
        }
      } catch (error) {
        console.error('Failed to load groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [lat, lng, radius]);

  if (loading) {
    return <div className="text-center text-fg-3">Loading groups...</div>;
  }

  if (groups.length === 0) {
    return <div className="text-center text-fg-4">No groups nearby. Create one to get started!</div>;
  }

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <Link
          key={group.id}
          href={`/groups/${group.id}`}
          className="block p-4 rounded-lg border border-line-1 bg-ink-900 hover:border-green transition-colors"
        >
          <div className="flex gap-3">
            {group.photo && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <Image src={group.photo} alt={group.name} fill className="object-cover" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-fg-1">{group.name}</h3>
              {group.description && <p className="text-[12px] text-fg-3 line-clamp-2">{group.description}</p>}
              <p className="text-[12px] text-fg-4 mt-1">{group.location_name}</p>
              <p className="text-[10px] text-fg-4">{group.members_count} members</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
