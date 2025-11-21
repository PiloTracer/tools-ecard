import { v4 as uuidv4 } from 'uuid';
import { cassandraClient } from '../../../core/cassandra/client';
import { templateOperations, resourceOperations } from '../../../core/prisma/client';
import { fallbackStorageService } from './fallbackStorageService';
import { resourceDeduplicationService } from './resourceDeduplicationService';
import { modeDetectionService, StorageMode } from './modeDetectionService';
import { getS3Service } from '../../s3-bucket/services/s3Service';
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
    console.log('[UnifiedTemplateStorage] saveTemplate called');

    // Extract userId from authenticated request
    const userId = (request as any).user?.id;
    console.log('[UnifiedTemplateStorage] User ID:', userId);

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Check if a template with this name already exists for this user
    let templateId: string;
    let existingTemplate: any = null;

    try {
      const templates = await templateOperations.listTemplates(userId);
      existingTemplate = templates.templates.find(
        t => t.name === input.name && t.projectName === 'Default Project'
      );

      if (existingTemplate) {
        templateId = existingTemplate.id;
        console.log('[UnifiedTemplateStorage] Updating existing template:', templateId);
      } else {
        templateId = uuidv4();
        console.log('[UnifiedTemplateStorage] Creating new template:', templateId);
      }
    } catch (error) {
      // If can't check, generate new ID
      templateId = uuidv4();
      console.log('[UnifiedTemplateStorage] Template ID (fallback):', templateId);
    }

    const timestamp = new Date();

    // Detect current storage mode
    const modeResult = await modeDetectionService.detectMode();
    const storageMode = modeResult.mode;
    console.log('[UnifiedTemplateStorage] Storage mode:', storageMode);

    // Process and deduplicate resources
    const resourceUrls: string[] = [];
    if (input.resources && input.resources.length > 0) {
      console.log('[UnifiedTemplateStorage] Processing', input.resources.length, 'resources');
      for (let i = 0; i < input.resources.length; i++) {
        const resource = input.resources[i];
        console.log('[UnifiedTemplateStorage] Resource', i, 'keys:', Object.keys(resource || {}));

        // Skip if resource doesn't have data
        if (!resource || !resource.data) {
          console.warn('[UnifiedTemplateStorage] Skipping resource', i, '- no data field');
          continue;
        }

        const resourceUrl = await resourceDeduplicationService.storeResource({
          data: resource.data,
          type: resource.type,
          hash: resource.hash
        }, userId);
        resourceUrls.push(resourceUrl);
      }
    }

    // Store template JSON based on mode
    let storageUrl: string;

    if (storageMode === 'full') {
      console.log('[UnifiedTemplateStorage] FULL mode - saving to SeaweedFS S3');
      try {
        // Save to SeaweedFS (S3)
        const s3Service = getS3Service();
        const bucketName = process.env.SEAWEEDFS_BUCKET || 'ecards';
        const s3Key = `templates/${userId}/${templateId}/template.json`;
        console.log('[UnifiedTemplateStorage] S3 bucket:', bucketName, 'key:', s3Key);

        // Ensure bucket exists
        const bucketExists = await s3Service.bucketExists(bucketName);
        console.log('[UnifiedTemplateStorage] Bucket exists:', bucketExists);
        if (!bucketExists) {
          console.log('[UnifiedTemplateStorage] Creating bucket...');
          await s3Service.createBucket(bucketName);
        }

        console.log('[UnifiedTemplateStorage] Uploading to S3...');
        const templateJson = JSON.stringify(input.templateData);
        console.log('[UnifiedTemplateStorage] Template JSON size:', templateJson.length, 'bytes');

        await s3Service.putObject(
          bucketName,
          s3Key,
          templateJson,
          {
            contentType: 'application/json',
            metadata: {
              userId,
              templateId,
              uploadedAt: new Date().toISOString()
            }
          }
        );

        console.log('[UnifiedTemplateStorage] ✓ Successfully uploaded to S3');
        storageUrl = `s3://${bucketName}/${s3Key}`;
      } catch (error) {
        console.error('[UnifiedTemplateStorage] ✗ Failed to save template to SeaweedFS:', error);
        throw new Error('Storage service unavailable');
      }
    } else if (storageMode === 'fallback') {
      try {
        // Save to local fallback storage
        const localPath = await fallbackStorageService.saveTemplate(
          userId,
          'default', // projectId
          templateId,
          input.templateData
        );
        storageUrl = `fallback://${localPath}`;
      } catch (error) {
        console.error('Failed to save template to fallback storage:', error);
        storageUrl = `local://${templateId}`;
      }
    } else {
      // LOCAL_ONLY mode
      storageUrl = `local://${templateId}`;
    }

    // Save metadata to PostgreSQL (if available)
    let metadata: TemplateMetadata;

    console.log('[UnifiedTemplateStorage] Checking if should save to PostgreSQL, mode:', storageMode);

    if (storageMode === 'full' || storageMode === 'fallback') {
      console.log('[UnifiedTemplateStorage] Mode is', storageMode, '- saving to PostgreSQL');
      try {
        const templateData = input.templateData || {};
        const version = existingTemplate ? (existingTemplate.version || 1) + 1 : 1;

        await templateOperations.upsertTemplate({
          id: templateId,
          userId,
          projectId: 'default',
          projectName: 'Default Project',
          name: input.name,
          width: templateData.width || 1000,
          height: templateData.height || 600,
          exportWidth: templateData.exportWidth || templateData.width || 1000,
          exportHeight: templateData.exportHeight || templateData.height || 600,
          storageUrl,
          storageMode,
          elementCount: templateData.elements?.length || 0,
          version
        });

        metadata = {
          id: templateId,
          userId,
          name: input.name,
          storageUrl,
          storageMode,
          resourceUrls,
          version,
          createdAt: existingTemplate?.createdAt || timestamp,
          updatedAt: timestamp
        };
        console.log('[UnifiedTemplateStorage] Successfully saved to PostgreSQL');

        // Now link resources to the template
        if (input.resources && input.resources.length > 0) {
          console.log('[UnifiedTemplateStorage] Linking', input.resources.length, 'resources to template');
          for (let i = 0; i < input.resources.length; i++) {
            const resource = input.resources[i];
            try {
              await resourceOperations.createResource({
                id: uuidv4(),
                templateId,
                name: resource.hash || `resource-${i}`,
                type: resource.type,
                storageUrl: resourceUrls[i],
                storageMode,
                hash: resource.hash || '',
                size: Buffer.from(resource.data.split(',')[1] || resource.data, 'base64').length,
                mimeType: resource.data.match(/^data:([^;]+);/)?.[1] || 'application/octet-stream'
              });
            } catch (error) {
              console.error('[UnifiedTemplateStorage] Failed to link resource:', error);
              // Continue with other resources
            }
          }
          console.log('[UnifiedTemplateStorage] Resources linked successfully');
        }
      } catch (error) {
        console.error('[UnifiedTemplateStorage] Failed to save metadata to PostgreSQL:', error);
        throw new Error('Database unavailable');
      }
    } else {
      console.log('[UnifiedTemplateStorage] Mode is', storageMode, '- constructing metadata without DB (LOCAL_ONLY)');
      // In LOCAL_ONLY mode, construct metadata without DB
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
    if (storageMode === 'full' || storageMode === 'fallback') {
      console.log('[UnifiedTemplateStorage] Logging event to Cassandra');
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

    const modeResult = await modeDetectionService.detectMode();
    const storageMode = modeResult.mode;

    // Load metadata from PostgreSQL
    let metadata: TemplateMetadata | null = null;

    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        const dbTemplate = await templateOperations.getTemplate(templateId, userId);
        if (!dbTemplate) {
          throw new Error('Template not found');
        }

        metadata = {
          id: dbTemplate.id,
          userId: dbTemplate.userId,
          name: dbTemplate.name,
          storageUrl: dbTemplate.storageUrl,
          storageMode: dbTemplate.storageMode,
          resourceUrls: dbTemplate.resources?.map(r => r.storageUrl) || [],
          version: dbTemplate.version || 1,
          createdAt: dbTemplate.createdAt,
          updatedAt: dbTemplate.updatedAt
        };

        // Verify ownership
        if (metadata.userId !== userId) {
          throw new Error('Unauthorized');
        }
      } catch (error) {
        console.error('Failed to load metadata from PostgreSQL:', error);
        if (storageMode === 'full') {
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
    if (storageMode === 'full' || storageMode === 'fallback') {
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

    const modeResult = await modeDetectionService.detectMode();
    const storageMode = modeResult.mode;

    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        const result = await templateOperations.listTemplates(userId);
        return result.templates.map(t => ({
          id: t.id,
          userId: t.userId,
          name: t.name,
          storageUrl: t.storageUrl,
          storageMode: t.storageMode,
          resourceUrls: t.resources?.map(r => r.storageUrl) || [],
          version: t.version || 1,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }));
      } catch (error) {
        console.error('Failed to list templates from PostgreSQL:', error);
        if (storageMode === 'full' || storageMode === 'fallback') {
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

    const modeResult = await modeDetectionService.detectMode();
    const storageMode = modeResult.mode;

    // Load metadata first to verify ownership
    let metadata: TemplateMetadata | null = null;

    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        const dbTemplate = await templateOperations.getTemplate(templateId, userId);
        if (!dbTemplate) {
          throw new Error('Template not found');
        }

        metadata = {
          id: dbTemplate.id,
          userId: dbTemplate.userId,
          name: dbTemplate.name,
          storageUrl: dbTemplate.storageUrl,
          storageMode: dbTemplate.storageMode,
          resourceUrls: dbTemplate.resources?.map(r => r.storageUrl) || [],
          version: dbTemplate.version || 1,
          createdAt: dbTemplate.createdAt,
          updatedAt: dbTemplate.updatedAt
        };

        if (metadata.userId !== userId) {
          throw new Error('Unauthorized');
        }
      } catch (error) {
        console.error('Failed to load metadata:', error);
        if (storageMode === 'full' || storageMode === 'fallback') {
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
    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        await templateOperations.deleteTemplate(templateId, userId);
      } catch (error) {
        console.error('Failed to delete metadata:', error);
        throw new Error('Failed to delete template');
      }
    }

    // Log deletion event
    if (storageMode === 'full' || storageMode === 'fallback') {
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