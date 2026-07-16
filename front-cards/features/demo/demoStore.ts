/**
 * Demo browser store — localStorage JSON + IndexedDB blobs
 */

import {
  DEMO_BATCHES_KEY,
  DEMO_BATCH_RECORDS_PREFIX,
  DEMO_BLOB_STORE,
  DEMO_FONTS_META_KEY,
  DEMO_IDB_NAME,
  DEMO_IDB_VERSION,
  DEMO_PROJECTS_KEY,
  DEMO_SELECTED_PROJECT_KEY,
  DEMO_TEMPLATES_KEY,
} from './demoConstants';

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function lsRemove(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DEMO_IDB_NAME, DEMO_IDB_VERSION);
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
  getProjects<T>(): T[] {
    return lsGet<T[]>(DEMO_PROJECTS_KEY, []);
  },

  setProjects<T>(projects: T[]): void {
    lsSet(DEMO_PROJECTS_KEY, projects);
  },

  getSelectedProjectId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(DEMO_SELECTED_PROJECT_KEY);
  },

  setSelectedProjectId(id: string | null): void {
    if (typeof window === 'undefined') return;
    if (id == null) {
      window.localStorage.removeItem(DEMO_SELECTED_PROJECT_KEY);
    } else {
      window.localStorage.setItem(DEMO_SELECTED_PROJECT_KEY, id);
    }
  },

  getTemplates<T>(): T[] {
    return lsGet<T[]>(DEMO_TEMPLATES_KEY, []);
  },

  setTemplates<T>(templates: T[]): void {
    lsSet(DEMO_TEMPLATES_KEY, templates);
  },

  getBatches<T>(): T[] {
    return lsGet<T[]>(DEMO_BATCHES_KEY, []);
  },

  setBatches<T>(batches: T[]): void {
    lsSet(DEMO_BATCHES_KEY, batches);
  },

  getBatchRecords<T>(batchId: string): T[] {
    return lsGet<T[]>(`${DEMO_BATCH_RECORDS_PREFIX}${batchId}`, []);
  },

  setBatchRecords<T>(batchId: string, records: T[]): void {
    lsSet(`${DEMO_BATCH_RECORDS_PREFIX}${batchId}`, records);
  },

  getFontsMeta<T>(): T[] {
    return lsGet<T[]>(DEMO_FONTS_META_KEY, []);
  },

  setFontsMeta<T>(fonts: T[]): void {
    lsSet(DEMO_FONTS_META_KEY, fonts);
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
    if (typeof window === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('ecards:demo:') && k !== 'ecards:demo:enabled') {
        keysToRemove.push(k);
      }
    }
    // also known keys
    [
      DEMO_PROJECTS_KEY,
      DEMO_SELECTED_PROJECT_KEY,
      DEMO_TEMPLATES_KEY,
      DEMO_BATCHES_KEY,
      DEMO_FONTS_META_KEY,
    ].forEach((k) => lsRemove(k));
    keysToRemove.forEach((k) => lsRemove(k));

    dbPromise = null;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DEMO_IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  },
};

export function newDemoId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
