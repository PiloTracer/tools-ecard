import { v4 as uuidv4 } from 'uuid';
import { cassandraClient } from '../../../core/cassandra/client';
import { templateOperations, resourceOperations, projectOperations } from '../../../core/prisma/client';
import { fallbackStorageService } from './fallbackStorageService';
import { resourceDeduplicationService } from './resourceDeduplicationService';
import { modeDetectionService, StorageMode } from './modeDetectionService';
import { getS3Service } from '../../s3-bucket/services/s3Service';
import type { Request } from 'express';
import { decodeBase64Data } from '../utils/base64Helper';
import { createLogger } from '../../../core/utils/logger';

const log = createLogger('TemplateStorage');

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
   * Sanitize email for use in storage paths
   */
  private sanitizeEmailForPath(email: string): string {
    return email
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/\+/g, '')
      .replace(/\./g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 100);
  }

  /**
   * Save a template with multi-mode storage support
   */
  async saveTemplate(
    input: SaveTemplateInput,
    request: Request
  ): Promise<TemplateMetadata> {
    // Extract userId and email from authenticated request
    const userId = (request as any).user?.id;
    const userEmail = (request as any).user?.email;

    log.debug({ userId, userEmail, templateName: input.name }, 'Starting template save');

    if (!userId || !userEmail) {
      throw new Error('User not authenticated');
    }

    // Sanitize email for use in path (consistent with batch-upload)
    const sanitizedEmail = this.sanitizeEmailForPath(userEmail);

    // Get or create user's default project
    const defaultProject = await projectOperations.getOrCreateDefaultProject(userId);
    const projectId = defaultProject.id;

    // Check if a template with this name already exists for this user in this project
    let templateId: string;
    let existingTemplate: any = null;

    try {
      const templates = await templateOperations.listTemplates(userId);
      existingTemplate = templates.templates.find(
        t => t.name === input.name && t.projectId === projectId
      );

      if (existingTemplate) {
        templateId = existingTemplate.id;
        log.debug({ templateId, projectId }, 'Updating existing template');
      } else {
        templateId = uuidv4();
        log.debug({ templateId, projectId }, 'Creating new template');
      }
    } catch (error) {
      // If can't check, generate new ID
      templateId = uuidv4();
      log.debug({ templateId }, 'Using fallback template ID');
    }

    const timestamp = new Date();

    // Detect current storage mode
    const modeResult = await modeDetectionService.detectMode();
    const storageMode = modeResult.mode;
    log.debug({ storageMode }, 'Detected storage mode');

    // Process and deduplicate resources
    const resourceUrls: string[] = [];
    if (input.resources && input.resources.length > 0) {
      log.debug({ resourceCount: input.resources.length }, 'Processing resources');

      // Note: projectId is already defined above from getOrCreateDefaultProject

      for (let i = 0; i < input.resources.length; i++) {
        const resource = input.resources[i];

        // Skip if resource doesn't have data
        if (!resource || !resource.data) {
          log.warn({ resourceIndex: i }, 'Skipping resource - no data field');
          continue;
        }

        const resourceUrl = await resourceDeduplicationService.storeResource({
          data: resource.data,
          type: resource.type,
          hash: resource.hash
        }, userId, {
          userEmail,
          projectName: projectId, // Using project ID for path consistency
          templateName: input.name
        });
        resourceUrls.push(resourceUrl);
      }
    }

    // Store template JSON based on mode
    let storageUrl: string;

    if (storageMode === 'full') {
      try {
        // Save to SeaweedFS (S3)
        const s3Service = getS3Service();
        const bucketName = process.env.SEAWEEDFS_BUCKET || 'repositories';

        // Note: projectId is already defined above from getOrCreateDefaultProject
        const sanitizedProjectId = this.sanitizeEmailForPath(projectId);
        const sanitizedTemplateName = this.sanitizeEmailForPath(input.name);

        const s3Key = `templates/${sanitizedEmail}/${sanitizedProjectId}/${sanitizedTemplateName}/template.json`;

        // Ensure bucket exists
        const bucketExists = await s3Service.bucketExists(bucketName);
        if (!bucketExists) {
          log.debug({ bucketName }, 'Creating S3 bucket');
          await s3Service.createBucket(bucketName);
        }

        const templateJson = JSON.stringify(input.templateData);
        log.debug({ bucketName, s3Key, sizeBytes: templateJson.length }, 'Uploading template to S3');

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

        log.info({ templateId, s3Key }, 'Template saved to S3');
        storageUrl = `s3://${bucketName}/${s3Key}`;
      } catch (error) {
        log.error({ error, templateId }, 'Failed to save template to SeaweedFS');
        throw new Error('Storage service unavailable');
      }
    } else if (storageMode === 'fallback') {
      try {
        // Save to local fallback storage
        // Note: projectId is already defined above from getOrCreateDefaultProject
        const localPath = await fallbackStorageService.saveTemplate(
          userEmail,
          projectId,
          input.name,
          input.templateData
        );
        storageUrl = `fallback://${localPath}`;
      } catch (error) {
        log.error({ error, templateId }, 'Failed to save template to fallback storage');
        storageUrl = `local://${input.name}`;
      }
    } else {
      // LOCAL_ONLY mode
      storageUrl = `local://${input.name}`;
    }

    // Save metadata to PostgreSQL (if available)
    let metadata: TemplateMetadata;

    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        const templateData = input.templateData || {};
        const version = existingTemplate ? (existingTemplate.version || 1) + 1 : 1;

        await templateOperations.upsertTemplate({
          id: templateId,
          userId,
          projectId: projectId, // Use actual default project ID from getOrCreateDefaultProject
          projectName: defaultProject.name, // Use actual default project name
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
        log.debug({ templateId, version }, 'Template metadata saved to PostgreSQL');

        // Now link resources to the template
        if (input.resources && input.resources.length > 0) {
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
                size: Buffer.from(resource.data.includes(',') ? resource.data.substring(resource.data.indexOf(',') + 1) : resource.data, 'base64').length,
                mimeType: resource.data.match(/^data:([^;]+);/)?.[1] || 'application/octet-stream'
              });
            } catch (error) {
              log.error({ error, resourceIndex: i, templateId }, 'Failed to link resource');
              // Continue with other resources
            }
          }
          log.debug({ resourceCount: input.resources.length, templateId }, 'Resources linked to template');
        }
      } catch (error) {
        log.error({ error, templateId }, 'Failed to save metadata to PostgreSQL');
        throw new Error('Database unavailable');
      }
    } else {
      log.debug({ storageMode }, 'LOCAL_ONLY mode - constructing metadata without DB');
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
        log.error({ error, templateId }, 'Failed to log event to Cassandra');
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
        log.error({ error, templateId }, 'Failed to load metadata from PostgreSQL');
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

    if (metadata.storageUrl.startsWith('s3://')) {
      try {
        // Parse S3 URL: s3://bucketName/templates/userId/templateId/template.json
        const s3UrlParts = metadata.storageUrl.replace('s3://', '').split('/');
        const bucketName = s3UrlParts[0];
        const s3Key = s3UrlParts.slice(1).join('/');

        log.debug({ bucketName, s3Key, templateId }, 'Loading template from S3');

        const s3Service = getS3Service();
        const s3Result = await s3Service.getObject(bucketName, s3Key);

        // Convert body (Readable or Buffer) to Buffer
        let buffer: Buffer;
        if (Buffer.isBuffer(s3Result.body)) {
          buffer = s3Result.body;
        } else {
          // Convert Readable stream to Buffer
          const chunks: Buffer[] = [];
          for await (const chunk of s3Result.body) {
            chunks.push(Buffer.from(chunk));
          }
          buffer = Buffer.concat(chunks);
        }

        templateData = JSON.parse(buffer.toString('utf-8'));
      } catch (error) {
        log.error({ error, templateId }, 'Failed to load template from S3');
        throw new Error('Failed to load template data from S3');
      }
    } else if (metadata.storageUrl.startsWith('fallback://')) {
      try {
        // Parse fallback:// URL to extract path components
        // Expected format: fallback://{basePath}/templates/{email}/{project}/{template}/template.json
        const filePath = metadata.storageUrl.replace('fallback://', '');
        const pathParts = filePath.split(/[/\\]/).filter(Boolean);

        // Find the templates index
        const templatesIndex = pathParts.findIndex(part => part === 'templates');

        if (templatesIndex === -1 || pathParts.length < templatesIndex + 4) {
          throw new Error('Invalid fallback URL format');
        }

        const userEmail = pathParts[templatesIndex + 1];
        const projectName = pathParts[templatesIndex + 2];
        const templateName = pathParts[templatesIndex + 3];

        log.debug({ userEmail, projectName, templateName, templateId }, 'Loading template from fallback storage');

        templateData = await fallbackStorageService.loadTemplate(
          userEmail,
          projectName,
          templateName
        );

        if (!templateData) {
          throw new Error('Template file not found in fallback storage');
        }
      } catch (error) {
        log.error({ error, templateId }, 'Failed to load template from fallback storage');
        throw new Error('Failed to load template data from fallback storage');
      }
    } else if (metadata.storageUrl.startsWith('local://')) {
      // In real implementation, would load from local storage
      templateData = { placeholder: 'local template data' };
    } else {
      throw new Error('Unknown storage URL format');
    }

    // Convert S3 URLs in templateData to HTTP URLs
    if (templateData && templateData.elements) {
      // Use public endpoint for browser access (not the Docker-internal endpoint)
      const apiEndpoint = process.env.API_PUBLIC_ENDPOINT || 'http://localhost:7400';
      templateData.elements = templateData.elements.map((element: any) => {
        if (element.type === 'image' && element.imageUrl && element.imageUrl.startsWith('s3://')) {
          // Convert s3://bucket/key to http://localhost:7400/api/v1/template-textile/resource/bucket/key
          const s3UrlParts = element.imageUrl.replace('s3://', '').split('/');
          const bucketName = s3UrlParts[0];
          const key = s3UrlParts.slice(1).join('/');
          const httpUrl = `${apiEndpoint}/api/v1/template-textile/resource/${bucketName}/${key}`;
          log.debug({ s3Url: element.imageUrl, httpUrl }, 'Converting S3 URL to HTTP');
          element.imageUrl = httpUrl;
        }
        return element;
      });
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
        log.error({ error, templateId }, 'Failed to log template access event');
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
        log.error({ error, userId }, 'Failed to list templates from PostgreSQL');
        if (storageMode === 'full' || storageMode === 'fallback') {
          throw new Error('Database unavailable');
        }
      }
    }

    // In FALLBACK or LOCAL_ONLY mode, return empty or cached list
    log.warn({ storageMode }, 'Operating in degraded mode, returning empty template list');
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
        log.error({ error, templateId }, 'Failed to load metadata for deletion');
        if (storageMode === 'full' || storageMode === 'fallback') {
          throw error;
        }
      }
    } else {
      // In degraded mode, we can't verify ownership
      throw new Error('Delete operation not available in degraded mode');
    }

    // Delete from storage
    if (metadata) {
      try {
        if (metadata.storageUrl.startsWith('s3://')) {
          // Delete from S3
          const s3Service = getS3Service();
          const match = metadata.storageUrl.match(/^s3:\/\/([^\/]+)\/(.+)$/);
          if (match) {
            const [, bucket, key] = match;
            await s3Service.deleteObject(bucket, key);
            log.debug({ bucket, key, templateId }, 'Deleted template from S3');
          }
        } else if (metadata.storageUrl.startsWith('fallback://')) {
          // Parse fallback URL to extract path components
          const filePath = metadata.storageUrl.replace('fallback://', '');
          const pathParts = filePath.split(/[/\\]/).filter(Boolean);
          const templatesIndex = pathParts.findIndex(part => part === 'templates');

          if (templatesIndex !== -1 && pathParts.length >= templatesIndex + 4) {
            const userEmail = pathParts[templatesIndex + 1];
            const projectName = pathParts[templatesIndex + 2];
            const templateName = pathParts[templatesIndex + 3];

            await fallbackStorageService.deleteTemplate(userEmail, projectName, templateName);
            log.debug({ templateId, templateName }, 'Deleted template from fallback storage');
          }
        }
      } catch (error) {
        log.error({ error, templateId }, 'Failed to delete from storage');
        // Continue with metadata deletion
      }
    }

    // Delete metadata from PostgreSQL
    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        await templateOperations.deleteTemplate(templateId, userId);
        log.info({ templateId }, 'Template deleted');
      } catch (error) {
        log.error({ error, templateId }, 'Failed to delete metadata');
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
        log.error({ error, templateId }, 'Failed to log deletion event');
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