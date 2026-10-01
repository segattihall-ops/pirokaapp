// Sync offline messages when connection is restored

import {
  getQueuedMessages,
  removeQueuedMessage,
  updateMessageRetry,
} from './indexed-db';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  const messages = await getQueuedMessages();
  let synced = 0;
  let failed = 0;

  for (const message of messages) {
    if (message.retries >= MAX_RETRIES) {
      console.warn(`Message ${message.id} exceeded max retries`);
      await removeQueuedMessage(message.id);
      failed++;
      continue;
    }

    try {
      const response = await fetch(message.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.payload),
      });

      if (response.ok) {
        await removeQueuedMessage(message.id);
        synced++;
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        await updateMessageRetry(message.id, `HTTP ${response.status}: ${errorText}`);
        failed++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      await updateMessageRetry(message.id, errorMsg);
      failed++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
  }

  return { synced, failed };
}

export function setupOfflineSyncListener(): void {
  if (typeof window === 'undefined') return;

  // Sync when online
  window.addEventListener('online', async () => {
    console.log('Connection restored, syncing offline queue...');
    const result = await syncOfflineQueue();
    console.log(`Sync complete: ${result.synced} synced, ${result.failed} failed`);

    if (result.synced > 0) {
      window.dispatchEvent(
        new CustomEvent('offline-queue-synced', {
          detail: { synced: result.synced, failed: result.failed },
        })
      );
    }
  });

  // Periodic sync (every 30 seconds if online)
  setInterval(async () => {
    if (navigator.onLine) {
      const messages = await getQueuedMessages();
      if (messages.length > 0) {
        await syncOfflineQueue();
      }
    }
  }, 30000);
}
