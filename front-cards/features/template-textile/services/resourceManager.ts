/**
 * Resource Manager
 * Handles resource upload, deduplication, and URL replacement
 */

import { browserStorageService } from './browserStorageService';
import { createHash } from 'crypto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

export interface Resource {
  type: string; // 'image', 'font', 'icon', etc.
  data: string; // Base64 or data URL
  hash?: string;
  url?: string;
}

export interface ProcessedResource {
  originalData: string;
  hash: string;
  url: string;
  type: string;
  cached: boolean;
}

class ResourceManager {
  private pendingUploads: Map<string, Promise<string>> = new Map();

  /**
   * Calculate SHA-256 hash of resource data
   */
  private async calculateHash(data: string): Promise<string> {
    // In browser, use Web Crypto API
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
      // Fallback for older browsers or Node.js environment
      // Note: This would need a polyfill in production
      return `hash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Extract resources from template data
   */
  async extractResources(templateData: any): Promise<Resource[]> {
    const resources: Resource[] = [];
    const processedUrls = new Set<string>();

    // Recursive function to find all data URLs and resource references
    const extractFromObject = async (obj: any, path: string = ''): Promise<void> => {
      if (!obj) return;

      if (typeof obj === 'string') {
        // Check if it's a data URL
        if (obj.startsWith('data:')) {
          if (!processedUrls.has(obj)) {
            processedUrls.add(obj);

            const [mimeInfo, base64Data] = obj.split(',');
            const mimeType = mimeInfo.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
            const type = this.getResourceType(mimeType);

            resources.push({
              type,
              data: obj,
              hash: await this.calculateHash(base64Data)
            });
          }
        }
        // Check if it's a blob URL or temporary URL
        else if (obj.startsWith('blob:') || obj.match(/^https?:\/\/.*\/(temp|tmp)\//)) {
          // These might need special handling
          console.warn('Found temporary URL that may need conversion:', obj);
        }
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          await extractFromObject(obj[i], `${path}[${i}]`);
        }
      } else if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          await extractFromObject(value, path ? `${path}.${key}` : key);
        }
      }
    };

    await extractFromObject(templateData);
    return resources;
  }

  /**
   * Determine resource type from MIME type
   */
  private getResourceType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('font/')) return 'font';
    if (mimeType.includes('font')) return 'font';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  }

  /**
   * Upload resources to server
   */
  async uploadResources(
    resources: Resource[],
    context?: {
      projectName?: string;
      templateName?: string;
    }
  ): Promise<ProcessedResource[]> {
    const processed: ProcessedResource[] = [];

    // Group resources by hash to avoid duplicate uploads
    const uniqueResources = new Map<string, Resource>();
    for (const resource of resources) {
      const hash = resource.hash || await this.calculateHash(resource.data);
      if (!uniqueResources.has(hash)) {
        uniqueResources.set(hash, { ...resource, hash });
      }
    }

    // Process each unique resource
    for (const [hash, resource] of uniqueResources.entries()) {
      try {
        // Check if already uploading
        if (this.pendingUploads.has(hash)) {
          const url = await this.pendingUploads.get(hash)!;
          processed.push({
            originalData: resource.data,
            hash,
            url,
            type: resource.type,
            cached: false
          });
          continue;
        }

        // Check local cache first
        const cached = await browserStorageService.getResource(hash);
        if (cached && cached.url) {
          processed.push({
            originalData: resource.data,
            hash,
            url: cached.url,
            type: resource.type,
            cached: true
          });
          continue;
        }

        // Upload to server with context
        const uploadPromise = this.uploadResource(resource, context);
        this.pendingUploads.set(hash, uploadPromise);

        const url = await uploadPromise;

        // Cache the result
        await browserStorageService.cacheResource({
          hash,
          url,
          data: resource.data,
          type: resource.type,
          timestamp: Date.now()
        });

        processed.push({
          originalData: resource.data,
          hash,
          url,
          type: resource.type,
          cached: false
        });

        this.pendingUploads.delete(hash);
      } catch (error) {
        console.error('Failed to upload resource:', error);
        this.pendingUploads.delete(hash);

        // Use data URL as fallback
        processed.push({
          originalData: resource.data,
          hash,
          url: resource.data, // Keep as data URL if upload fails
          type: resource.type,
          cached: false
        });
      }
    }

    return processed;
  }

  /**
   * Upload a single resource to the server
   */
  private async uploadResource(
    resource: Resource,
    context?: {
      projectName?: string;
      templateName?: string;
    }
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/v1/template-textile/resources`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resources: [{
          data: resource.data,
          type: resource.type,
          hash: resource.hash
        }],
        projectName: context?.projectName || 'Default Project',
        templateName: context?.templateName || 'Untitled'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to upload resource: ${response.statusText}`);
    }

    const result = await response.json();
    const uploadedResource = result.data?.resources?.[0];

    if (!uploadedResource?.url) {
      throw new Error('No URL returned from resource upload');
    }

    return uploadedResource.url;
  }

  /**
   * Replace data URLs with resource URLs in template
   */
  replaceResourceUrls(templateData: any, resourceMap: Map<string, string>): any {
    if (!templateData) return templateData;

    // Deep clone to avoid modifying original
    const cloned = JSON.parse(JSON.stringify(templateData));

    // Recursive function to replace URLs
    const replaceInObject = (obj: any): any => {
      if (!obj) return obj;

      if (typeof obj === 'string') {
        // Check if it's a data URL that we have a replacement for
        if (obj.startsWith('data:')) {
          for (const [originalUrl, newUrl] of resourceMap.entries()) {
            if (obj === originalUrl) {
              return newUrl;
            }
          }
        }
        return obj;
      } else if (Array.isArray(obj)) {
        return obj.map(item => replaceInObject(item));
      } else if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceInObject(value);
        }
        return result;
      }

      return obj;
    };

    return replaceInObject(cloned);
  }

  /**
   * Process template for saving (extract and upload resources)
   */
  async processTemplateForSave(
    templateData: any,
    context?: {
      projectName?: string;
      templateName?: string;
    }
  ): Promise<{
    processedTemplate: any;
    resources: ProcessedResource[];
  }> {
    // Extract all resources from template
    const resources = await this.extractResources(templateData);

    if (resources.length === 0) {
      return {
        processedTemplate: templateData,
        resources: []
      };
    }

    // Upload resources and get URLs with context
    const processedResources = await this.uploadResources(resources, context);

    // Create map of original data URL to new URL
    const resourceMap = new Map<string, string>();
    for (const resource of processedResources) {
      resourceMap.set(resource.originalData, resource.url);
    }

    // Replace data URLs with resource URLs
    const processedTemplate = this.replaceResourceUrls(templateData, resourceMap);

    return {
      processedTemplate,
      resources: processedResources
    };
  }

  /**
   * Preload resources for a template
   */
  async preloadResources(resourceUrls: string[]): Promise<void> {
    const promises = resourceUrls.map(async (url) => {
      try {
        // Check if already cached
        const cached = await browserStorageService.getResourceByUrl(url);
        if (cached) return;

        // Fetch and cache the resource
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const dataUrl = await this.blobToDataUrl(blob);
          const hash = await this.calculateHash(dataUrl);

          await browserStorageService.cacheResource({
            hash,
            url,
            data: dataUrl,
            type: this.getResourceType(blob.type),
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Failed to preload resource:', url, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Clean up old cached resources
   */
  async cleanupCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await browserStorageService.clearResourceCache(maxAgeMs);
  }
}

// Export singleton instance
export const resourceManager = new ResourceManager();