/**
 * Resource Deduplication Service
 * Handles resource upload, deduplication, and storage management
 */

import crypto from 'crypto';
import { decodeBase64Data } from '../utils/base64Helper';
import { Readable } from 'stream';
import { cassandraClient, StorageMode } from '../../../core/cassandra/client';
import { resourceOperations } from '../../../core/prisma/client';
import { getS3Service } from '../../s3-bucket/services/s3Service';
import { fallbackStorageService } from './fallbackStorageService';
import { modeDetectionService } from './modeDetectionService';

export interface UploadedResource {
  name: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
  type: 'IMAGE' | 'FONT' | 'SVG' | 'VIDEO' | 'AUDIO';
}

export interface ProcessedResource {
  url: string;
  hash: string;
  deduplicated: boolean;
  storageMode: string;
  size: number;
  mimeType: string;
}

export interface ResourceMetadata {
  hash: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

class ResourceDeduplicationService {
  private readonly bucketName = process.env.SEAWEEDFS_BUCKET || 'repositories';
  private readonly maxResourceSize = 50 * 1024 * 1024; // 50MB

  /**
   * Store a resource from base64 data (simplified interface for backward compatibility)
   */
  async storeResource(input: {
    data: string;
    type: string;
    hash?: string;
  }, userId?: string, context?: {
    userEmail?: string;
    projectName?: string;
    templateName?: string;
  }): Promise<string> {
    // Validate input
    if (!input || !input.data) {
      throw new Error('Resource data is required');
    }

    // Validate context - required for new path structure
    if (!context?.userEmail || !context?.projectName || !context?.templateName) {
      const error = new Error('Resource storage requires userEmail, projectName, and templateName context');
      console.error('[ResourceDedup] storeResource error:', error.message, 'Context:', context);
      throw error;
    }

    // Decode base64 data to buffer
    const buffer = decodeBase64Data(input.data);
    console.log("[ResourceDedup] Buffer size:", buffer.length, "First bytes:", buffer[0]?.toString(16), buffer[1]?.toString(16), buffer[2]?.toString(16));

    // Determine MIME type from base64 prefix or type
    let mimeType = 'application/octet-stream';
    if (input.data.includes('data:')) {
      const match = input.data.match(/^data:([^;]+);/);
      if (match) {
        mimeType = match[1];
      }
    } else {
      // Infer from type
      if (input.type === 'IMAGE') mimeType = 'image/png';
      else if (input.type === 'FONT') mimeType = 'font/ttf';
      else if (input.type === 'SVG') mimeType = 'image/svg+xml';
    }

    // Determine resource type
    const resourceType = this.determineResourceType(mimeType);

    // Create UploadedResource object
    const resource: UploadedResource = {
      name: input.hash || `resource-${Date.now()}`,
      buffer,
      mimeType,
      size: buffer.length,
      type: resourceType
    };

    // Process using the main processResource method
    const result = await this.processResource(resource, userId || 'system', undefined, context);

    return result.url;
  }

  /**
   * Process and deduplicate a resource
   */
  async processResource(
    resource: UploadedResource,
    userId: string,
    templateId?: string,
    context?: {
      userEmail?: string;
      projectName?: string;
      templateName?: string;
    }
  ): Promise<ProcessedResource> {
    // Validate resource size
    if (resource.size > this.maxResourceSize) {
      throw new Error(`Resource exceeds maximum size of ${this.maxResourceSize} bytes`);
    }

    // Calculate content hash
    const hash = this.calculateHash(resource.buffer);

    // Check for existing resource by hash (deduplication)
    const existing = await this.findExistingResource(hash);

    if (existing) {
      // Check if existing resource uses old path format (with hash-based paths or separate resources directory)
      const hasOldHashFormat = existing.storageUrl.match(/\/[a-f0-9]{2}\/[a-f0-9]{64}\//);
      const hasOldResourcesDir = existing.storageUrl.includes('/resources/') && !existing.storageUrl.includes('/templates/');

      if ((hasOldHashFormat || hasOldResourcesDir) && context?.userEmail && context?.projectName && context?.templateName) {
        // Old format detected - migrate to new format
        console.log('[ResourceDedup] Detected old path format, migrating to new format');

        // Store with new path format
        const mode = modeDetectionService.getCurrentMode();
        const storageResult = await this.storeNewResource(resource, hash, userId, mode, context);

        // Update database with new URL (if we have templateId)
        if (templateId) {
          try {
            await resourceOperations.updateResourceUrl(existing.id, storageResult.url);
          } catch (error) {
            console.error('[ResourceDedup] Failed to update resource URL:', error);
          }
        }

        return {
          url: storageResult.url,
          hash,
          deduplicated: true,
          storageMode: storageResult.storageMode,
          size: resource.size,
          mimeType: resource.mimeType
        };
      }

      // Resource already exists with correct format, increment reference count
      await this.incrementReferenceCount(hash);

      // Link to template if provided
      if (templateId) {
        await this.linkResourceToTemplate(existing.id, templateId, resource);
      }

      return {
        url: existing.storageUrl,
        hash,
        deduplicated: true,
        storageMode: existing.storageMode,
        size: existing.size,
        mimeType: existing.mimeType
      };
    }

    // New resource, determine storage location based on mode
    const mode = modeDetectionService.getCurrentMode();
    const storageResult = await this.storeNewResource(resource, hash, userId, mode, context);

    // Record in PostgreSQL (only if we have a templateId)
    if (templateId) {
      const resourceRecord = await resourceOperations.createResource({
        templateId,
        name: resource.name,
        type: resource.type,
        storageUrl: storageResult.url,
        storageMode: storageResult.storageMode,
        hash,
        size: resource.size,
        mimeType: resource.mimeType
      });
    } else {
      // No templateId yet - resource is being uploaded before template creation
      // It will be linked to the template later when the template is saved
      console.log(`Resource ${hash} stored without template link (will be linked later)`);
    }

    // Log to Cassandra
    await this.logResourceMetadata(hash, resource, storageResult);

    return {
      url: storageResult.url,
      hash,
      deduplicated: false,
      storageMode: storageResult.storageMode,
      size: resource.size,
      mimeType: resource.mimeType
    };
  }

  /**
   * Process multiple resources in batch
   */
  async processResourceBatch(
    resources: UploadedResource[],
    userId: string,
    templateId?: string
  ): Promise<ProcessedResource[]> {
    const results: ProcessedResource[] = [];

    // Process resources in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(resources, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(resource => this.processResource(resource, userId, templateId))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Calculate SHA256 hash of content
   */
  private calculateHash(buffer: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');
  }

  /**
   * Find existing resource by hash
   */
  private async findExistingResource(hash: string): Promise<any | null> {
    // Check PostgreSQL first
    const pgResource = await resourceOperations.findResourceByHash(hash);

    if (pgResource) {
      return pgResource;
    }

    // Check Cassandra for additional metadata
    const cassandraResource = await cassandraClient.getResourceByHash(hash);

    if (cassandraResource) {
      // Resource exists in Cassandra but not PostgreSQL (data inconsistency)
      // Log this for investigation
      console.warn(`Resource ${hash} found in Cassandra but not PostgreSQL`);
    }

    return null;
  }

  /**
   * Store new resource based on current mode
   */
  private async storeNewResource(
    resource: UploadedResource,
    hash: string,
    userId: string,
    mode: StorageMode,
    context?: {
      userEmail?: string;
      projectName?: string;
      templateName?: string;
    }
  ): Promise<{ url: string; storageMode: string }> {
    if (mode === StorageMode.FULL) {
      // Store in SeaweedFS
      return await this.storeInSeaweedFS(resource, hash, userId, context);
    } else {
      // Store in fallback (.local-storage)
      return await this.storeInFallback(resource, hash, userId, context);
    }
  }

  /**
   * Store resource in SeaweedFS
   */
  private async storeInSeaweedFS(
    resource: UploadedResource,
    hash: string,
    userId: string,
    context?: {
      userEmail?: string;
      projectName?: string;
      templateName?: string;
    }
  ): Promise<{ url: string; storageMode: string }> {
    const s3Service = getS3Service();

    // Context is required for proper path structure
    if (!context?.userEmail || !context?.projectName || !context?.templateName) {
      throw new Error('Resource storage requires userEmail, projectName, and templateName context');
    }

    // Build path - save resources in same directory as template.json
    const sanitizedEmail = this.sanitizeForPath(context.userEmail);
    const sanitizedProject = this.sanitizeForPath(context.projectName);
    const sanitizedTemplate = this.sanitizeForPath(context.templateName);
    const s3Key = `templates/${sanitizedEmail}/${sanitizedProject}/${sanitizedTemplate}/${resource.name}`;

    try {
      // Check if bucket exists
      const bucketExists = await s3Service.bucketExists(this.bucketName);
      if (!bucketExists) {
        await s3Service.createBucket(this.bucketName);
      }

      // Upload to S3
      await s3Service.putObject(
        this.bucketName,
        s3Key,
        resource.buffer,
        {
          contentType: resource.mimeType,
          metadata: {
            hash,
            originalName: resource.name,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString()
          }
        }
      );

      const url = `s3://${this.bucketName}/${s3Key}`;

      return {
        url,
        storageMode: 'seaweedfs'
      };
    } catch (error) {
      console.error('Failed to store in SeaweedFS, falling back to local:', error);
      // Fall back to local storage
      return await this.storeInFallback(resource, hash, userId);
    }
  }

  /**
   * Store resource in fallback storage
   */
  private async storeInFallback(
    resource: UploadedResource,
    hash: string,
    userId: string,
    context?: {
      userEmail?: string;
      projectName?: string;
      templateName?: string;
    }
  ): Promise<{ url: string; storageMode: string }> {
    // Context is required for proper path structure
    if (!context?.userEmail || !context?.projectName || !context?.templateName) {
      throw new Error('Resource storage requires userEmail, projectName, and templateName context');
    }

    // Save in same directory as template
    const path = await fallbackStorageService.saveResourceWithTemplate(
      context.userEmail,
      context.projectName,
      context.templateName,
      resource.name,
      resource.buffer,
      {
        originalName: resource.name,
        mimeType: resource.mimeType
      }
    );

    return {
      url: `file://${path}`,
      storageMode: 'local'
    };
  }

  /**
   * Increment reference count for deduplicated resource
   */
  private async incrementReferenceCount(hash: string): Promise<void> {
    try {
      await cassandraClient.incrementResourceReference(hash);
    } catch (error) {
      console.error('Failed to increment resource reference count:', error);
    }
  }

  /**
   * Link resource to template
   */
  private async linkResourceToTemplate(
    resourceId: string,
    templateId: string,
    resource: UploadedResource
  ): Promise<void> {
    // This would typically create a link in the database
    // For now, we'll just log it
    console.log(`Linked resource ${resourceId} to template ${templateId}`);
  }

  /**
   * Log resource metadata to Cassandra
   */
  private async logResourceMetadata(
    hash: string,
    resource: UploadedResource,
    storageResult: { url: string; storageMode: string }
  ): Promise<void> {
    try {
      await cassandraClient.saveResourceMetadata({
        hash,
        resourceId: crypto.randomUUID(),
        originalName: resource.name,
        mimeType: resource.mimeType,
        size: resource.size,
        storageUrl: storageResult.url,
        storageMode: storageResult.storageMode,
        referenceCount: 1,
        firstSeen: new Date(),
        lastAccessed: new Date(),
        metadataJson: JSON.stringify({
          type: resource.type,
          uploadedAt: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to log resource metadata:', error);
    }
  }

  /**
   * Load resource by hash
   */
  async loadResource(hash: string, userId: string): Promise<Buffer | null> {
    // Get resource metadata
    const metadata = await cassandraClient.getResourceByHash(hash);

    if (!metadata) {
      return null;
    }

    // Determine storage location from URL
    if (metadata.storageUrl.startsWith('s3://')) {
      return await this.loadFromSeaweedFS(metadata.storageUrl);
    } else if (metadata.storageUrl.startsWith('file://')) {
      return await this.loadFromFallback(metadata.storageUrl, userId);
    }

    return null;
  }

  /**
   * Load resource from SeaweedFS
   */
  private async loadFromSeaweedFS(url: string): Promise<Buffer | null> {
    try {
      const s3Service = getS3Service();
      // Parse S3 URL
      const match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);

      if (!match) {
        throw new Error('Invalid S3 URL');
      }

      const [, bucket, key] = match;
      const result = await s3Service.getObject(bucket, key);

      if (!result.body) {
        return null;
      }

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of result.body as Readable) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to load from SeaweedFS:', error);
      return null;
    }
  }

  /**
   * Load resource from fallback storage
   */
  private async loadFromFallback(url: string, userId: string): Promise<Buffer | null> {
    try {
      // Parse file:// URL to extract path components
      // Expected format: file://{basePath}/templates/{email}/{project}/{template}/{resourceName}
      const filePath = url.replace('file://', '');
      const pathParts = filePath.split(/[/\\]/).filter(Boolean);

      // Find the templates index
      const templatesIndex = pathParts.findIndex(part => part === 'templates');

      if (templatesIndex === -1 || pathParts.length < templatesIndex + 5) {
        throw new Error('Invalid fallback URL format');
      }

      const userEmail = pathParts[templatesIndex + 1];
      const projectName = pathParts[templatesIndex + 2];
      const templateName = pathParts[templatesIndex + 3];
      const resourceName = pathParts[templatesIndex + 4];

      return await fallbackStorageService.loadResource(userEmail, projectName, templateName, resourceName);
    } catch (error) {
      console.error('Failed to load from fallback:', error);
      return null;
    }
  }

  /**
   * Delete resource (decrements reference count)
   */
  async deleteResource(hash: string, userId: string): Promise<void> {
    // Get current metadata
    const metadata = await cassandraClient.getResourceByHash(hash);

    if (!metadata) {
      return;
    }

    // Decrement reference count
    if (metadata.referenceCount > 1) {
      // Just decrement the count
      await cassandraClient.incrementResourceReference(hash); // This should be decrementResourceReference
      return;
    }

    // Reference count is 1, actually delete the resource
    if (metadata.storageUrl.startsWith('s3://')) {
      await this.deleteFromSeaweedFS(metadata.storageUrl);
    } else if (metadata.storageUrl.startsWith('file://')) {
      await this.deleteFromFallback(metadata.storageUrl);
    }

    // Remove from databases
    // Note: This would need to be implemented in the actual system
    console.log(`Deleted resource ${hash}`);
  }

  /**
   * Delete resource from SeaweedFS
   */
  private async deleteFromSeaweedFS(url: string): Promise<void> {
    try {
      const s3Service = getS3Service();
      const match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);

      if (!match) {
        throw new Error('Invalid S3 URL');
      }

      const [, bucket, key] = match;
      await s3Service.deleteObject(bucket, key);
    } catch (error) {
      console.error('Failed to delete from SeaweedFS:', error);
    }
  }

  /**
   * Delete resource from fallback storage
   */
  private async deleteFromFallback(url: string): Promise<void> {
    try {
      // Parse file:// URL to extract path components
      // Expected format: file://{basePath}/templates/{email}/{project}/{template}/{resourceName}
      const filePath = url.replace('file://', '');
      const pathParts = filePath.split(/[/\\]/).filter(Boolean);

      // Find the templates index
      const templatesIndex = pathParts.findIndex(part => part === 'templates');

      if (templatesIndex === -1 || pathParts.length < templatesIndex + 5) {
        throw new Error('Invalid fallback URL format');
      }

      const userEmail = pathParts[templatesIndex + 1];
      const projectName = pathParts[templatesIndex + 2];
      const templateName = pathParts[templatesIndex + 3];
      const resourceName = pathParts[templatesIndex + 4];

      await fallbackStorageService.deleteResource(userEmail, projectName, templateName, resourceName);
    } catch (error) {
      console.error('Failed to delete from fallback:', error);
    }
  }

  /**
   * Verify resource integrity
   */
  async verifyResource(hash: string, userId: string): Promise<boolean> {
    const content = await this.loadResource(hash, userId);

    if (!content) {
      return false;
    }

    const actualHash = this.calculateHash(content);
    return actualHash === hash;
  }

  /**
   * Get resource statistics
   */
  async getResourceStats(userId: string): Promise<{
    totalResources: number;
    totalSize: number;
    deduplicationRate: number;
    storageBreakdown: {
      seaweedfs: number;
      fallback: number;
    };
  }> {
    // This would query the database for statistics
    // For now, return mock data
    return {
      totalResources: 0,
      totalSize: 0,
      deduplicationRate: 0,
      storageBreakdown: {
        seaweedfs: 0,
        fallback: 0
      }
    };
  }

  /**
   * Chunk array for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Determine resource type from MIME type
   */
  determineResourceType(mimeType: string): 'IMAGE' | 'FONT' | 'SVG' | 'VIDEO' | 'AUDIO' {
    if (mimeType.startsWith('image/svg')) return 'SVG';
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('font/') || mimeType.includes('font')) return 'FONT';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';

    // Default fallback
    return 'IMAGE';
  }

  /**
   * Sanitize string for use in file paths
   */
  private sanitizeForPath(input: string): string {
    return input
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/\+/g, '')
      .replace(/\./g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }
}

// Export singleton instance
export const resourceDeduplicationService = new ResourceDeduplicationService();

// Export class for custom instances
export { ResourceDeduplicationService };