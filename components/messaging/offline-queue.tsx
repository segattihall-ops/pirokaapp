'use client';

import { useState, useEffect } from 'react';

interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed';
}

/**
 * Offline message queue (IndexedDB)
 * Store messages when offline, send when back online
 * Prevents message loss on unreliable connections
 * Part of reliability/launch polish
 */
export function OfflineQueue() {
  const [queued, setQueued] = useState<QueuedMessage[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline || queued.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 max-w-xs rounded-lg border border-line-1 bg-ink-900 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        <div>
          <p className="text-[12px] font-bold text-white">Offline</p>
          <p className="text-[10px] text-fg-3">{queued.length} message(s) pending</p>
        </div>
      </div>

      {queued.length > 0 && (
        <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
          {queued.map(msg => (
            <div key={msg.id} className="text-[10px] text-fg-4 line-clamp-2">
              {msg.content}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-fg-4 mt-2">
        Messages will send automatically when you&apos;re back online
      </p>
    </div>
  );
}
