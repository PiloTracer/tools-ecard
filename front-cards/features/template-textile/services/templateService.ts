/**
 * Template Service
 * Handles API communication for template saving and loading with multi-mode storage support
 */

import { browserStorageService, type CachedTemplate } from './browserStorageService';
import { resourceManager } from './resourceManager';
import type { Template, TemplateElement } from '../types';
import { getApiBaseUrl } from '@/shared/lib/api-base-url';

/**
 * Calls same-origin `/api/*` (or proxied API). On 401, tries POST `/api/auth/refresh-token`
 * then repeats once — fixes expired access tokens while ecards_refresh is still valid.
 */
async function apiFetchWithRefresh(input: string, init: RequestInit): Promise<Response> {
  const first = await fetch(input, { ...init, credentials: 'include' });
  if (first.status !== 401) {
    return first;
  }

  const refreshUrl = `${getApiBaseUrl()}/api/auth/refresh-token`;
  const refresh = await fetch(refreshUrl, {
    method: 'POST',
    credentials: 'include',
  });

  if (!refresh.ok) {
    return first;
  }

  return fetch(input, { ...init, credentials: 'include' });
}

export type StorageMode = 'FULL' | 'FALLBACK' | 'LOCAL_ONLY';

export interface SaveTemplateRequest {
  name: string;
  templateData: Template;
}

export interface TemplateMetadata {
  id: string;
  userId: string;
  name: string;
  storageUrl: string;
  storageMode: StorageMode;
  resourceUrls: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadedTemplate {
  id: string;
  userId: string;
  name: string;
  data: Template;
  resources: string[];
  metadata: TemplateMetadata;
}

class TemplateService {
  private currentMode: StorageMode | null = null;

  /**
   * Get current storage mode from API
   */
  async getStorageMode(): Promise<StorageMode> {
    try {
      const response = await apiFetchWithRefresh(`${getApiBaseUrl()}/api/v1/template-textile/mode`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mode: StorageMode = data.data?.mode || 'FALLBACK';
        this.currentMode = mode;
        return mode;
      }
    } catch (error) {
      console.error('Failed to get storage mode:', error);
    }

    // Default to fallback mode on error
    this.currentMode = navigator.onLine ? 'FALLBACK' : 'LOCAL_ONLY';
    return this.currentMode;
  }

  /**
   * Save a template with multi-mode support
   */
  async saveTemplate(request: SaveTemplateRequest): Promise<TemplateMetadata> {
    const mode = await this.getStorageMode();

    // IMPORTANT: According to the feature documentation, images should be stored
    // as full-resolution PNG data URLs in the template JSON, NOT as separate resources.
    // The resource extraction/deduplication system is disabled for now.
    // See: .claude/features/FEATURE-TEMPLATE-TEXTILE.md - "Storage: Full-resolution PNG data URLs stored in template JSON"

    // Use the template data as-is (already contains rasterized PNG data URLs from CanvasControls)
    const processedTemplate = request.templateData;
    const resources: any[] = []; // No separate resources

    // Prepare resource data for API (empty array)
    const resourceData: any[] = [];

    if (mode === 'LOCAL_ONLY') {
      // Save only to local storage
      const templateId = this.generateId();
      const metadata: TemplateMetadata = {
        id: templateId,
        userId: 'local',
        name: request.name,
        storageUrl: `local://${templateId}`,
        storageMode: 'LOCAL_ONLY',
        resourceUrls: resources.map(r => r.url),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Cache template locally
      await browserStorageService.cacheTemplate({
        id: templateId,
        name: request.name,
        data: processedTemplate,
        resources: resources.map(r => r.url),
        timestamp: Date.now(),
        userId: 'local'
      });

      return metadata;
    }

    try {
      // Try to save to server
      const response = await apiFetchWithRefresh(`${getApiBaseUrl()}/api/v1/template-textile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: request.name,
          templateData: processedTemplate,
          resources: resourceData
        })
      });

      if (response.ok) {
        const result = await response.json();
        const metadata = result.data as TemplateMetadata;

        // Also cache locally for offline access
        await browserStorageService.cacheTemplate({
          id: metadata.id,
          name: metadata.name,
          data: processedTemplate,
          resources: metadata.resourceUrls,
          timestamp: Date.now(),
          userId: metadata.userId
        });

        return metadata;
      }

      const authHint =
        response.status === 401
          ? ' Session expired or not signed in — sign in again or check you use the same host as login (e.g. localhost vs 127.0.0.1).'
          : '';
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}.${authHint}`
      );
    } catch (error) {
      console.error('Failed to save to server:', error);

      if (mode === 'FALLBACK') {
        // Fallback to local storage
        const templateId = this.generateId();
        const metadata: TemplateMetadata = {
          id: templateId,
          userId: 'fallback',
          name: request.name,
          storageUrl: `fallback://${templateId}`,
          storageMode: 'FALLBACK',
          resourceUrls: resources.map(r => r.url),
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await browserStorageService.cacheTemplate({
          id: templateId,
          name: request.name,
          data: processedTemplate,
          resources: resources.map(r => r.url),
          timestamp: Date.now(),
          userId: 'fallback'
        });

        return metadata;
      }

      throw error;
    }
  }

  /**
   * Load a template by ID
   */
  async loadTemplate(templateId: string): Promise<LoadedTemplate> {
    const mode = await this.getStorageMode();

    // Check local cache first
    const cached = await browserStorageService.getTemplate(templateId);
    if (cached && mode === 'LOCAL_ONLY') {
      return {
        id: cached.id,
        userId: cached.userId || 'local',
        name: cached.name,
        data: cached.data,
        resources: cached.resources,
        metadata: {
          id: cached.id,
          userId: cached.userId || 'local',
          name: cached.name,
          storageUrl: `local://${cached.id}`,
          storageMode: 'LOCAL_ONLY',
          resourceUrls: cached.resources,
          version: 1,
          createdAt: new Date(cached.timestamp),
          updatedAt: new Date(cached.timestamp)
        }
      };
    }

    if (mode !== 'LOCAL_ONLY') {
      try {
        // Try to load from server
        const response = await apiFetchWithRefresh(`${getApiBaseUrl()}/api/v1/template-textile/${templateId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          const template = result.data as LoadedTemplate;

          // Normalize storageMode in metadata
          if (template.metadata) {
            template.metadata.storageMode = typeof template.metadata.storageMode === 'string'
              ? template.metadata.storageMode
              : (template.metadata.storageMode as any)?.mode || 'FALLBACK';
          }

          // Cache locally for offline access
          await browserStorageService.cacheTemplate({
            id: template.id,
            name: template.name,
            data: template.data,
            resources: template.resources,
            timestamp: Date.now(),
            userId: template.userId
          });

          // Preload resources
          await resourceManager.preloadResources(template.resources);

          return template;
        }
      } catch (error) {
        console.error('Failed to load from server:', error);
      }
    }

    // Fallback to cached version
    if (cached) {
      return {
        id: cached.id,
        userId: cached.userId || 'fallback',
        name: cached.name,
        data: cached.data,
        resources: cached.resources,
        metadata: {
          id: cached.id,
          userId: cached.userId || 'fallback',
          name: cached.name,
          storageUrl: `fallback://${cached.id}`,
          storageMode: mode || 'FALLBACK',
          resourceUrls: cached.resources,
          version: 1,
          createdAt: new Date(cached.timestamp),
          updatedAt: new Date(cached.timestamp)
        }
      };
    }

    throw new Error('Template not found');
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<TemplateMetadata[]> {
    const mode = await this.getStorageMode();

    if (mode === 'LOCAL_ONLY') {
      // List from local storage only
      const cached = await browserStorageService.listTemplates();
      return cached.map(t => ({
        id: t.id,
        userId: t.userId || 'local',
        name: t.name,
        storageUrl: `local://${t.id}`,
        storageMode: 'LOCAL_ONLY',
        resourceUrls: t.resources,
        version: 1,
        createdAt: new Date(t.timestamp),
        updatedAt: new Date(t.timestamp)
      }));
    }

    try {
      // Try to list from server
      const response = await apiFetchWithRefresh(`${getApiBaseUrl()}/api/v1/template-textile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const templates = (result.data as TemplateMetadata[]).map(t => ({
          ...t,
          // Normalize storageMode: if it's an object with a 'mode' property, extract it
          storageMode: typeof t.storageMode === 'string'
            ? t.storageMode
            : (t.storageMode as any)?.mode || 'FALLBACK'
        }));

        // Merge with local templates
        const localTemplates = await browserStorageService.listTemplates();
        const serverIds = new Set(templates.map(t => t.id));

        // Add local-only templates
        for (const local of localTemplates) {
          if (!serverIds.has(local.id)) {
            templates.push({
              id: local.id,
              userId: local.userId || 'local',
              name: local.name,
              storageUrl: `local://${local.id}`,
              storageMode: 'LOCAL_ONLY',
              resourceUrls: local.resources,
              version: 1,
              createdAt: new Date(local.timestamp),
              updatedAt: new Date(local.timestamp)
            });
          }
        }

        return templates;
      }
    } catch (error) {
      console.error('Failed to list from server:', error);
    }

    // Fallback to local templates
    const cached = await browserStorageService.listTemplates();
    return cached.map(t => ({
      id: t.id,
      userId: t.userId || 'fallback',
      name: t.name,
      storageUrl: `fallback://${t.id}`,
      storageMode: mode || 'FALLBACK',
      resourceUrls: t.resources,
      version: 1,
      createdAt: new Date(t.timestamp),
      updatedAt: new Date(t.timestamp)
    }));
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    // Always delete from local cache
    await browserStorageService.deleteTemplate(templateId);

    // Attempt server delete — silently handle any error since local cache is clean.
    // The server response is advisory: if it fails, listTemplates() may return the
    // template from the server, but a subsequent delete will retry with the same ID.
    try {
      const response = await apiFetchWithRefresh(`${getApiBaseUrl()}/api/v1/template-textile/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 404) {
        const body = await response.json().catch(() => null);
        console.warn(
          `Server returned ${response.status} on delete — template removed locally:`,
          body?.error || response.statusText
        );
      }
    } catch {
      // Network error — local cache is already clean
    }
  }

  /**
   * Sync local templates with server
   */
  async syncTemplates(): Promise<{
    uploaded: number;
    downloaded: number;
    errors: string[];
  }> {
    const mode = await this.getStorageMode();

    if (mode !== 'FULL') {
      throw new Error('Sync only available in full mode');
    }

    const results = {
      uploaded: 0,
      downloaded: 0,
      errors: [] as string[]
    };

    try {
      // Get local templates
      const localTemplates = await browserStorageService.listTemplates();

      // Get server templates
      const serverTemplates = await this.listTemplates();
      const serverIds = new Set(serverTemplates.map(t => t.id));

      // Upload local-only templates
      for (const local of localTemplates) {
        if (!serverIds.has(local.id)) {
          try {
            await this.saveTemplate({
              name: local.name,
              templateData: local.data
            });
            results.uploaded++;
          } catch (error) {
            results.errors.push(`Failed to upload ${local.name}: ${error}`);
          }
        }
      }

      // Download server-only templates
      const localIds = new Set(localTemplates.map(t => t.id));
      for (const server of serverTemplates) {
        if (!localIds.has(server.id)) {
          try {
            await this.loadTemplate(server.id);
            results.downloaded++;
          } catch (error) {
            results.errors.push(`Failed to download ${server.name}: ${error}`);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Sync failed: ${error}`);
    }

    return results;
  }

  /**
   * Generate a unique ID for local templates
   */
  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await browserStorageService.clearAllCache();
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return browserStorageService.getStorageStats();
  }
}

// Export singleton instance
export const templateService = new TemplateService();