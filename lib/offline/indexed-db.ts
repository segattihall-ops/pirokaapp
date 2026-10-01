// IndexedDB offline queue for reliable message delivery

interface OfflineMessage {
  id: string;
  type: 'message' | 'profile_update' | 'photo_upload';
  endpoint: string;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
  lastError?: string;
}

const DB_NAME = 'pirokaapp-offline';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

export async function enqueueOfflineMessage(
  type: 'message' | 'profile_update' | 'photo_upload',
  endpoint: string,
  payload: Record<string, any>
): Promise<string> {
  const db = await getDB();
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const message: OfflineMessage = {
    id,
    type,
    endpoint,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(message);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
  });
}

export async function getQueuedMessages(): Promise<OfflineMessage[]> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as OfflineMessage[]);
  });
}

export async function removeQueuedMessage(id: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function updateMessageRetry(id: string, error: string): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const message = getRequest.result as OfflineMessage;
      message.retries += 1;
      message.lastError = error;

      const updateRequest = store.put(message);
      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve();
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
