'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProfileCardProps {
  userId: string;
  handle: string;
  pronouns?: string[];
  age?: number;
  distance?: string;
  intent?: string;
  photoBlur?: number; // 0-100 blur percentage based on trust
  mainPhoto?: string;
  trusted?: boolean;
}

/**
 * Profile card with progressive blur based on trust level
 * - No trust: fully blurred (unsafe stranger)
 * - Some trust: partial blur
 * - Verified: no blur
 */
export function ProfileCard({
  userId,
  handle,
  pronouns = [],
  age,
  distance,
  intent,
  photoBlur = 50,
  mainPhoto,
  trusted = false,
}: ProfileCardProps) {
  const [showAlbum, setShowAlbum] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* Main photo with progressive blur */}
      <div className="relative w-full aspect-square bg-gray-800">
        {mainPhoto && (
          <Image
            src={mainPhoto}
            alt={handle}
            fill
            className="object-cover"
            style={{
              filter: photoBlur > 0 ? `blur(${Math.round(photoBlur * 0.2)}px)` : 'none',
            }}
          />
        )}
        {photoBlur > 0 && (
          <div className="absolute inset-0 bg-gray-900 opacity-30" />
        )}
      </div>

      {/* Profile info */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{handle}</h3>
          {pronouns.length > 0 && (
            <p className="text-sm text-gray-400">{pronouns.join(' / ')}</p>
          )}
          {age && <p className="text-sm text-gray-400">{age} years old</p>}
        </div>

        {distance && (
          <div className="text-sm text-green-400">{distance} away</div>
        )}

        {intent && (
          <div className="inline-block px-2 py-1 bg-purple-600 rounded text-xs text-white">
            {intent}
          </div>
        )}

        {/* Trust badge */}
        {trusted && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <span>✓</span> Verified
          </div>
        )}

        {/* Album & Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setShowAlbum(!showAlbum)}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
          >
            Album
          </button>
          <button
            onClick={() => setReportOpen(!reportOpen)}
            className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
          >
            Report
          </button>
        </div>
      </div>

      {/* Album grid (expandable) */}
      {showAlbum && (
        <div className="border-t border-gray-700 p-4">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square bg-gray-800 rounded flex items-center justify-center text-gray-500"
              >
                <span>Photo {i}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report form (expandable) */}
      {reportOpen && (
        <div className="border-t border-gray-700 p-4">
          <textarea
            placeholder="Tell us what's wrong..."
            className="w-full bg-gray-800 text-white rounded p-2 text-sm mb-2"
            rows={3}
          />
          <button className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded">
            Send Report
          </button>
        </div>
      )}
    </div>
  );
}
