/**
 * Demo browser store — localStorage JSON + IndexedDB blobs, scoped per OAuth user.
 */

import { isDemoMode } from './isDemoMode';
import { resolveDemoStorageUserId, demoUserIdbName, demoUserStoragePrefix } from './demoStorageUserId';
import { DEMO_BATCH_RECORDS_PREFIX, DEMO_BLOB_STORE, DEMO_IDB_VERSION } from './demoConstants';

const KEY_SUFFIX = {
  projects: 'projects',
  selectedProjectId: 'selectedProjectId',
  templates: 'templates',
  batches: 'batches',
  fonts: 'fonts',
  mappingPresets: 'mappingPresets',
} as const;

let activeUserId: string | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function requireUserId(): string | null {
  return activeUserId;
}

function scopedKey(suffix: string): string | null {
  const uid = requireUserId();
  if (!uid) return null;
  return `${demoUserStoragePrefix(uid)}${suffix}`;
}

function lsGet<T>(key: string | null, fallback: T): T {
  if (!key || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string | null, value: unknown): void {
  if (!key || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function openDb(): Promise<IDBDatabase> {
  const uid = requireUserId();
  if (!uid) {
    return Promise.reject(new Error('Demo store: no active user'));
  }
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  const dbName = demoUserIdbName(uid);
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, DEMO_IDB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DEMO_BLOB_STORE)) {
          db.createObjectStore(DEMO_BLOB_STORE, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

export const demoStore = {
  setActiveUserId(userId: string | null): void {
    if (activeUserId === userId) return;
    activeUserId = userId;
    dbPromise = null;
  },

  getActiveUserId(): string | null {
    return activeUserId;
  },

  getProjects<T>(): T[] {
    return lsGet<T[]>(scopedKey(KEY_SUFFIX.projects), []);
  },

  setProjects<T>(projects: T[]): void {
    lsSet(scopedKey(KEY_SUFFIX.projects), projects);
  },

  getSelectedProjectId(): string | null {
    const key = scopedKey(KEY_SUFFIX.selectedProjectId);
    if (!key || typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },

  setSelectedProjectId(id: string | null): void {
    const key = scopedKey(KEY_SUFFIX.selectedProjectId);
    if (!key || typeof window === 'undefined') return;
    if (id == null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, id);
    }
  },

  getTemplates<T>(): T[] {
    return lsGet<T[]>(scopedKey(KEY_SUFFIX.templates), []);
  },

  setTemplates<T>(templates: T[]): void {
    lsSet(scopedKey(KEY_SUFFIX.templates), templates);
  },

  getBatches<T>(): T[] {
    return lsGet<T[]>(scopedKey(KEY_SUFFIX.batches), []);
  },

  setBatches<T>(batches: T[]): void {
    lsSet(scopedKey(KEY_SUFFIX.batches), batches);
  },

  getBatchRecords<T>(batchId: string): T[] {
    return lsGet<T[]>(scopedKey(`${DEMO_BATCH_RECORDS_PREFIX}${batchId}`), []);
  },

  setBatchRecords<T>(batchId: string, records: T[]): void {
    lsSet(scopedKey(`${DEMO_BATCH_RECORDS_PREFIX}${batchId}`), records);
  },

  getFontsMeta<T>(): T[] {
    return lsGet<T[]>(scopedKey(KEY_SUFFIX.fonts), []);
  },

  setFontsMeta<T>(fonts: T[]): void {
    lsSet(scopedKey(KEY_SUFFIX.fonts), fonts);
  },

  getMappingPresets<T>(): T[] {
    return lsGet<T[]>(scopedKey(KEY_SUFFIX.mappingPresets), []);
  },

  setMappingPresets<T>(presets: T[]): void {
    lsSet(scopedKey(KEY_SUFFIX.mappingPresets), presets);
  },

  async putBlob(id: string, data: string, mimeType: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEMO_BLOB_STORE, 'readwrite');
      tx.objectStore(DEMO_BLOB_STORE).put({ id, data, mimeType, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getBlob(id: string): Promise<{ id: string; data: string; mimeType: string } | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEMO_BLOB_STORE, 'readonly');
      const req = tx.objectStore(DEMO_BLOB_STORE).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteBlob(id: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DEMO_BLOB_STORE, 'readwrite');
      tx.objectStore(DEMO_BLOB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll(): Promise<void> {
    const uid = requireUserId();
    if (!uid || typeof window === 'undefined') return;

    const prefix = demoUserStoragePrefix(uid);
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));

    const dbName = demoUserIdbName(uid);
    dbPromise = null;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  },
};

export function bindDemoStoreToOAuthUser(
  user: Pick<{ id: string; email: string }, 'id' | 'email'> | null
): void {
  if (!isDemoMode()) {
    demoStore.setActiveUserId(null);
    return;
  }
  demoStore.setActiveUserId(resolveDemoStorageUserId(user));
}

export function newDemoId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
