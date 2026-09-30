'use client';

import { useState } from 'react';

interface Favorite {
  userId: string;
  handle: string;
  photoBlur: number;
  distance: number;
  matchScore?: number;
  starred: boolean;
}

interface FavoritesProps {
  favorites?: Favorite[];
  onRemove?: (userId: string) => void;
}

/**
 * Favorites list with match scoring
 * Star profiles to save for later
 * Sorted by match score and recency
 * Syncs with taste learning system
 */
export function Favorites({ favorites = [], onRemove }: FavoritesProps) {
  const [filter, setFilter] = useState<'all' | 'starred'>('all');

  const displayed = favorites.filter(f => {
    if (filter === 'starred') return f.starred;
    return true;
  });

  const handleStar = async (userId: string, isStarred: boolean) => {
    try {
      await fetch('/api/matching/favorite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, starred: !isStarred }),
      });
    } catch (error) {
      console.error('Star error:', error);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-white">Favorites</h2>
        <span className="text-[12px] text-fg-3">{displayed.length} profiles</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 rounded text-[12px] font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          All ({favorites.length})
        </button>
        <button
          onClick={() => setFilter('starred')}
          className={`px-3 py-2 rounded text-[12px] font-semibold transition-colors ${
            filter === 'starred'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          Starred ({favorites.filter(f => f.starred).length})
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="text-center text-fg-3 py-8 text-[12px]">
            {filter === 'starred'
              ? 'No starred favorites yet'
              : 'No favorites yet. Start liking profiles!'}
          </div>
        ) : (
          displayed.map(fav => (
            <div
              key={fav.userId}
              className="p-3 rounded-lg border border-line-2 bg-white/[0.04] flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-lg bg-white/10" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{fav.handle}</p>
                <div className="flex gap-2 mt-1">
                  {fav.matchScore && (
                    <span className="text-[10px] text-green font-bold">
                      {fav.matchScore}% match
                    </span>
                  )}
                  <span className="text-[10px] text-fg-4">{fav.distance.toFixed(1)} km</span>
                </div>
              </div>
              <button
                onClick={() => handleStar(fav.userId, fav.starred)}
                className="text-[16px] hover:scale-110 transition-transform"
              >
                {fav.starred ? '⭐' : '☆'}
              </button>
              <button
                onClick={() => onRemove?.(fav.userId)}
                className="text-[12px] text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
