/**
 * Browser Storage Service
 * IndexedDB wrapper for resource caching and offline template storage
 */

const DB_NAME = 'template-textile-storage';
const DB_VERSION = 1;
const RESOURCE_STORE = 'resources';
const TEMPLATE_STORE = 'templates';

export interface CachedResource {
  hash: string;
  url: string;
  data: string;
  type: string;
  timestamp: number;
}

export interface CachedTemplate {
  id: string;
  name: string;
  data: any;
  resources: string[];
  timestamp: number;
  userId?: string;
}

class BrowserStorageService {
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create resources store
        if (!db.objectStoreNames.contains(RESOURCE_STORE)) {
          const resourceStore = db.createObjectStore(RESOURCE_STORE, { keyPath: 'hash' });
          resourceStore.createIndex('url', 'url', { unique: false });
          resourceStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create templates store
        if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
          const templateStore = db.createObjectStore(TEMPLATE_STORE, { keyPath: 'id' });
          templateStore.createIndex('name', 'name', { unique: false });
          templateStore.createIndex('userId', 'userId', { unique: false });
          templateStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  /**
   * Cache a resource in IndexedDB
   */
  async cacheResource(resource: CachedResource): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);

      const request = store.put({
        ...resource,
        timestamp: resource.timestamp || Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to cache resource:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a cached resource by hash
   */
  async getResource(hash: string): Promise<CachedResource | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE], 'readonly');
      const store = transaction.objectStore(RESOURCE_STORE);
      const request = store.get(hash);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('Failed to get resource:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a cached resource by URL
   */
  async getResourceByUrl(url: string): Promise<CachedResource | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE], 'readonly');
      const store = transaction.objectStore(RESOURCE_STORE);
      const index = store.index('url');
      const request = index.get(url);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('Failed to get resource by URL:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Cache a template locally
   */
  async cacheTemplate(template: CachedTemplate): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEMPLATE_STORE], 'readwrite');
      const store = transaction.objectStore(TEMPLATE_STORE);

      const request = store.put({
        ...template,
        timestamp: template.timestamp || Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to cache template:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a cached template by ID
   */
  async getTemplate(id: string): Promise<CachedTemplate | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEMPLATE_STORE], 'readonly');
      const store = transaction.objectStore(TEMPLATE_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('Failed to get template:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * List cached templates for a user
   */
  async listTemplates(userId?: string): Promise<CachedTemplate[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEMPLATE_STORE], 'readonly');
      const store = transaction.objectStore(TEMPLATE_STORE);

      let request: IDBRequest;
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        console.error('Failed to list templates:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a cached template
   */
  async deleteTemplate(id: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TEMPLATE_STORE], 'readwrite');
      const store = transaction.objectStore(TEMPLATE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to delete template:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached resources (older than specified age)
   */
  async clearResourceCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const db = await this.ensureDb();
    const cutoffTime = Date.now() - maxAgeMs;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE], 'readwrite');
      const store = transaction.objectStore(RESOURCE_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);

      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('Failed to clear resource cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE, TEMPLATE_STORE], 'readwrite');

      const clearResources = transaction.objectStore(RESOURCE_STORE).clear();
      const clearTemplates = transaction.objectStore(TEMPLATE_STORE).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Failed to clear cache:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    resourceCount: number;
    templateCount: number;
    estimatedSize?: number;
  }> {
    const db = await this.ensureDb();

    const stats = {
      resourceCount: 0,
      templateCount: 0,
      estimatedSize: undefined as number | undefined
    };

    // Count resources
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([RESOURCE_STORE], 'readonly');
      const store = transaction.objectStore(RESOURCE_STORE);
      const request = store.count();

      request.onsuccess = () => {
        stats.resourceCount = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    // Count templates
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([TEMPLATE_STORE], 'readonly');
      const store = transaction.objectStore(TEMPLATE_STORE);
      const request = store.count();

      request.onsuccess = () => {
        stats.templateCount = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    // Try to get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        stats.estimatedSize = estimate.usage;
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }

    return stats;
  }
}

// Export singleton instance
export const browserStorageService = new BrowserStorageService();