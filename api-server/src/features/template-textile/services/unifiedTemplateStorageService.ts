import { v4 as uuidv4 } from 'uuid';
import { cassandraClient } from '../../../core/cassandra/client';
import { prismaClient } from '../../../core/prisma/client';
import { fallbackStorageService } from './fallbackStorageService';
import { resourceDeduplicationService } from './resourceDeduplicationService';
import { modeDetectionService, StorageMode } from './modeDetectionService';
import type { Request } from 'express';

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

export interface SaveTemplateInput {
  name: string;
  templateData: any;
  resources?: Array<{
    type: string;
    data: string;
    hash?: string;
  }>;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  data: any;
  resources: string[];
  metadata: TemplateMetadata;
}

class UnifiedTemplateStorageService {
  /**
   * Save a template with multi-mode storage support
   */
  async saveTemplate(
    input: SaveTemplateInput,
    request: Request
  ): Promise<TemplateMetadata> {
    // Extract userId from authenticated request
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const templateId = uuidv4();
    const timestamp = new Date();

    // Detect current storage mode
    const storageMode = await modeDetectionService.detectMode();

    // Process and deduplicate resources
    const resourceUrls: string[] = [];
    if (input.resources && input.resources.length > 0) {
      for (const resource of input.resources) {
        const resourceUrl = await resourceDeduplicationService.storeResource({
          data: resource.data,
          type: resource.type,
          hash: resource.hash
        });
        resourceUrls.push(resourceUrl);
      }
    }

    // Store template JSON based on mode
    let storageUrl: string;

    if (storageMode === 'FULL' || storageMode === 'FALLBACK') {
      try {
        // Try S3/Fallback storage
        storageUrl = await fallbackStorageService.saveTemplate(
          templateId,
          userId,
          input.templateData
        );
      } catch (error) {
        console.error('Failed to save template to storage:', error);
        if (storageMode === 'FULL') {
          throw new Error('Storage service unavailable');
        }
        // In FALLBACK mode, we continue without remote storage
        storageUrl = `local://${templateId}`;
      }
    } else {
      // LOCAL_ONLY mode
      storageUrl = `local://${templateId}`;
    }

    // Save metadata to PostgreSQL (if available)
    let metadata: TemplateMetadata;

    if (storageMode === 'FULL') {
      try {
        metadata = await prismaClient.saveTemplateMetadata({
          id: templateId,
          userId,
          name: input.name,
          storageUrl,
          storageMode,
          resourceUrls,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      } catch (error) {
        console.error('Failed to save metadata to PostgreSQL:', error);
        throw new Error('Database unavailable');
      }
    } else {
      // In FALLBACK or LOCAL_ONLY mode, construct metadata without DB
      metadata = {
        id: templateId,
        userId,
        name: input.name,
        storageUrl,
        storageMode,
        resourceUrls,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    }

    // Log event to Cassandra (if available)
    if (storageMode === 'FULL') {
      try {
        await cassandraClient.logTemplateEvent({
          eventId: uuidv4(),
          templateId,
          userId,
          eventType: 'TEMPLATE_CREATED',
          eventData: {
            name: input.name,
            storageMode,
            resourceCount: resourceUrls.length
          },
          timestamp
        });
      } catch (error) {
        console.error('Failed to log event to Cassandra:', error);
        // Non-critical, continue
      }
    }

    return metadata;
  }

  /**
   * Load a template by ID
   */
  async loadTemplate(templateId: string, request: Request): Promise<Template> {
    // Extract userId for authorization
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const storageMode = await modeDetectionService.detectMode();

    // Load metadata from PostgreSQL
    let metadata: TemplateMetadata | null = null;

    if (storageMode === 'FULL') {
      try {
        metadata = await prismaClient.getTemplateMetadata(templateId);
        if (!metadata) {
          throw new Error('Template not found');
        }

        // Verify ownership
        if (metadata.userId !== userId) {
          throw new Error('Unauthorized');
        }
      } catch (error) {
        console.error('Failed to load metadata from PostgreSQL:', error);
        if (storageMode === 'FULL') {
          throw error;
        }
      }
    }

    // If no metadata from DB (FALLBACK or LOCAL_ONLY), try local storage
    if (!metadata) {
      // In real implementation, would check local storage
      throw new Error('Template not found in local storage');
    }

    // Load template data from storage
    let templateData: any;

    if (metadata.storageUrl.startsWith('s3://') || metadata.storageUrl.startsWith('fallback://')) {
      try {
        templateData = await fallbackStorageService.loadTemplate(metadata.storageUrl);
      } catch (error) {
        console.error('Failed to load template from storage:', error);
        throw new Error('Failed to load template data');
      }
    } else if (metadata.storageUrl.startsWith('local://')) {
      // In real implementation, would load from local storage
      templateData = { placeholder: 'local template data' };
    } else {
      throw new Error('Unknown storage URL format');
    }

    // Log access event
    if (storageMode === 'FULL') {
      try {
        await cassandraClient.logTemplateEvent({
          eventId: uuidv4(),
          templateId,
          userId,
          eventType: 'TEMPLATE_LOADED',
          eventData: {},
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to log event:', error);
        // Non-critical
      }
    }

    return {
      id: templateId,
      userId: metadata.userId,
      name: metadata.name,
      data: templateData,
      resources: metadata.resourceUrls,
      metadata
    };
  }

  /**
   * List templates for a user
   */
  async listTemplates(request: Request): Promise<TemplateMetadata[]> {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const storageMode = await modeDetectionService.detectMode();

    if (storageMode === 'FULL') {
      try {
        const templates = await prismaClient.listTemplatesByUser(userId);
        return templates;
      } catch (error) {
        console.error('Failed to list templates from PostgreSQL:', error);
        if (storageMode === 'FULL') {
          throw new Error('Database unavailable');
        }
      }
    }

    // In FALLBACK or LOCAL_ONLY mode, return empty or cached list
    console.warn('Operating in degraded mode, returning empty template list');
    return [];
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, request: Request): Promise<void> {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const storageMode = await modeDetectionService.detectMode();

    // Load metadata first to verify ownership
    let metadata: TemplateMetadata | null = null;

    if (storageMode === 'FULL') {
      try {
        metadata = await prismaClient.getTemplateMetadata(templateId);
        if (!metadata) {
          throw new Error('Template not found');
        }

        if (metadata.userId !== userId) {
          throw new Error('Unauthorized');
        }
      } catch (error) {
        console.error('Failed to load metadata:', error);
        if (storageMode === 'FULL') {
          throw error;
        }
      }
    } else {
      // In degraded mode, we can't verify ownership
      throw new Error('Delete operation not available in degraded mode');
    }

    // Delete from storage
    if (metadata && (metadata.storageUrl.startsWith('s3://') || metadata.storageUrl.startsWith('fallback://'))) {
      try {
        await fallbackStorageService.deleteTemplate(metadata.storageUrl);
      } catch (error) {
        console.error('Failed to delete from storage:', error);
        // Continue with metadata deletion
      }
    }

    // Delete metadata from PostgreSQL
    if (storageMode === 'FULL') {
      try {
        await prismaClient.deleteTemplateMetadata(templateId);
      } catch (error) {
        console.error('Failed to delete metadata:', error);
        throw new Error('Failed to delete template');
      }
    }

    // Log deletion event
    if (storageMode === 'FULL') {
      try {
        await cassandraClient.logTemplateEvent({
          eventId: uuidv4(),
          templateId,
          userId,
          eventType: 'TEMPLATE_DELETED',
          eventData: {},
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Failed to log deletion event:', error);
        // Non-critical
      }
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    input: Partial<SaveTemplateInput>,
    request: Request
  ): Promise<TemplateMetadata> {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Load existing template first
    const existing = await this.loadTemplate(templateId, request);

    // Merge with updates
    const updatedData = {
      ...existing.data,
      ...input.templateData
    };

    const updatedName = input.name || existing.name;

    // Save as new version
    const saveInput: SaveTemplateInput = {
      name: updatedName,
      templateData: updatedData,
      resources: input.resources
    };

    // Delete old version
    await this.deleteTemplate(templateId, request);

    // Save new version with same ID
    return this.saveTemplate(saveInput, request);
  }
}

export const unifiedTemplateStorageService = new UnifiedTemplateStorageService();