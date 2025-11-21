/**
 * Template Storage Service
 * Manages template persistence in SeaweedFS with user authentication and versioning
 */

import { getS3Service } from '../../s3-bucket/services/s3Service';
import type {
  Template,
  TemplateMetadata,
  StoredTemplate,
  TemplateResource,
  SaveTemplateRequest,
  ListTemplatesResponse,
  TemplateVersion
} from '../types';
import { Readable } from 'stream';

export class TemplateStorageService {
  private s3Service = getS3Service();
  private readonly bucketName = 'ecards';
  private readonly maxVersions = 3; // Keep last 3 versions

  /**
   * Generate S3 key for template storage
   */
  private getTemplateKey(userId: string, projectName: string, templateName: string, version?: number): string {
    const cleanProjectName = this.sanitizePath(projectName);
    const cleanTemplateName = this.sanitizePath(templateName);
    const versionSuffix = version ? `.v${version}` : '';
    return `${userId}/${cleanProjectName}/${cleanTemplateName}/template${versionSuffix}.json`;
  }

  /**
   * Generate S3 key for template resources
   */
  private getResourceKey(userId: string, projectName: string, templateName: string, resourceName: string): string {
    const cleanProjectName = this.sanitizePath(projectName);
    const cleanTemplateName = this.sanitizePath(templateName);
    const cleanResourceName = this.sanitizePath(resourceName);
    return `${userId}/${cleanProjectName}/${cleanTemplateName}/resources/${cleanResourceName}`;
  }

  /**
   * Generate S3 key for template metadata
   */
  private getMetadataKey(userId: string, projectName: string, templateName: string): string {
    const cleanProjectName = this.sanitizePath(projectName);
    const cleanTemplateName = this.sanitizePath(templateName);
    return `${userId}/${cleanProjectName}/${cleanTemplateName}/metadata.json`;
  }

  /**
   * Sanitize path component to prevent directory traversal
   */
  private sanitizePath(path: string): string {
    return path
      .replace(/[^a-zA-Z0-9-_\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .slice(0, 100); // Limit length
  }

  /**
   * Save template to S3
   */
  async saveTemplate(userId: string, request: SaveTemplateRequest): Promise<TemplateMetadata> {
    const { templateName, projectName, template, resources = [] } = request;

    // Check bucket exists
    const bucketExists = await this.s3Service.bucketExists(this.bucketName);
    if (!bucketExists) {
      await this.s3Service.createBucket(this.bucketName);
    }

    // Get current metadata if exists
    const metadataKey = this.getMetadataKey(userId, projectName, templateName);
    let currentMetadata: TemplateMetadata | null = null;
    let nextVersion = 1;

    try {
      const existingMetadata = await this.s3Service.getObject(this.bucketName, metadataKey);
      if (existingMetadata.body) {
        const chunks: Buffer[] = [];
        for await (const chunk of existingMetadata.body as Readable) {
          chunks.push(Buffer.from(chunk));
        }
        currentMetadata = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        nextVersion = (currentMetadata?.version || 0) + 1;
      }
    } catch (error) {
      // No existing metadata, this is a new template
      console.log('No existing template found, creating new one');
    }

    // Create metadata
    const metadata: TemplateMetadata = {
      id: template.id,
      name: templateName,
      projectName,
      userId,
      version: nextVersion,
      width: template.width,
      height: template.height,
      elementCount: template.elements.length,
      createdAt: currentMetadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastModifiedBy: userId,
      tags: [],
      description: ''
    };

    // Archive current version if exists and we're at version limit
    if (currentMetadata && nextVersion > 1) {
      await this.archiveVersion(userId, projectName, templateName, currentMetadata.version);
    }

    // Create stored template
    const storedTemplate: StoredTemplate = {
      metadata,
      template,
      resources
    };

    // Save main template file
    const templateKey = this.getTemplateKey(userId, projectName, templateName);
    const templateData = Buffer.from(JSON.stringify(storedTemplate, null, 2));

    await this.s3Service.putObject(
      this.bucketName,
      templateKey,
      templateData,
      {
        contentType: 'application/json',
        metadata: {
          'userId': userId,
          'templateId': template.id,
          'version': nextVersion.toString()
        }
      }
    );

    // Save metadata separately for quick listing
    await this.s3Service.putObject(
      this.bucketName,
      metadataKey,
      Buffer.from(JSON.stringify(metadata, null, 2)),
      {
        contentType: 'application/json'
      }
    );

    // Save resources if any
    for (const resource of resources) {
      const resourceKey = this.getResourceKey(userId, projectName, templateName, resource.name);
      // Note: In a real implementation, you would fetch and store the actual resource data
      // For now, we just store the resource metadata
      await this.s3Service.putObject(
        this.bucketName,
        resourceKey + '.meta',
        Buffer.from(JSON.stringify(resource)),
        {
          contentType: 'application/json'
        }
      );
    }

    // Clean up old versions
    await this.cleanupOldVersions(userId, projectName, templateName);

    return metadata;
  }

  /**
   * Load template from S3
   */
  async loadTemplate(userId: string, projectName: string, templateName: string, version?: number): Promise<StoredTemplate> {
    const templateKey = this.getTemplateKey(userId, projectName, templateName, version);

    try {
      const result = await this.s3Service.getObject(this.bucketName, templateKey);

      if (!result.body) {
        throw new Error('Template not found');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of result.body as Readable) {
        chunks.push(Buffer.from(chunk));
      }

      const templateData = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      return templateData as StoredTemplate;
    } catch (error) {
      console.error('Error loading template:', error);
      throw new Error(`Failed to load template: ${templateName}`);
    }
  }

  /**
   * List all templates for a user
   */
  async listTemplates(userId: string, page: number = 1, pageSize: number = 20): Promise<ListTemplatesResponse> {
    const prefix = `${userId}/`;

    try {
      const result = await this.s3Service.listObjects(this.bucketName, {
        prefix,
        delimiter: '/',
        maxKeys: 1000
      });

      const templates: TemplateMetadata[] = [];

      // Process each project folder
      for (const prefix of result.commonPrefixes || []) {
        const projectResult = await this.s3Service.listObjects(this.bucketName, {
          prefix,
          delimiter: '/',
          maxKeys: 1000
        });

        // Process each template folder in the project
        for (const templatePrefix of projectResult.commonPrefixes || []) {
          const metadataKey = `${templatePrefix}metadata.json`;

          try {
            const metadataResult = await this.s3Service.getObject(this.bucketName, metadataKey);
            if (metadataResult.body) {
              const chunks: Buffer[] = [];
              for await (const chunk of metadataResult.body as Readable) {
                chunks.push(Buffer.from(chunk));
              }
              const metadata = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
              templates.push(metadata);
            }
          } catch (error) {
            console.error(`Error loading metadata for ${metadataKey}:`, error);
          }
        }
      }

      // Sort by updated date (newest first)
      templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // Paginate results
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTemplates = templates.slice(startIndex, endIndex);

      return {
        templates: paginatedTemplates,
        total: templates.length,
        page,
        pageSize
      };
    } catch (error) {
      console.error('Error listing templates:', error);
      return {
        templates: [],
        total: 0,
        page,
        pageSize
      };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(userId: string, projectName: string, templateName: string): Promise<void> {
    const prefix = `${userId}/${this.sanitizePath(projectName)}/${this.sanitizePath(templateName)}/`;

    try {
      // List all objects with this prefix
      const result = await this.s3Service.listObjects(this.bucketName, {
        prefix,
        maxKeys: 1000
      });

      if (result.objects.length > 0) {
        // Delete all objects
        const keys = result.objects.map(obj => obj.key);
        await this.s3Service.deleteObjects(this.bucketName, keys);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error(`Failed to delete template: ${templateName}`);
    }
  }

  /**
   * Check if user has permission to access template
   */
  async checkPermission(userId: string, templateUserId: string, permission: 'read' | 'write' | 'delete'): Promise<boolean> {
    // For now, users can only access their own templates
    // In future, implement sharing logic here
    return userId === templateUserId;
  }

  /**
   * Get template versions
   */
  async getVersions(userId: string, projectName: string, templateName: string): Promise<TemplateVersion[]> {
    const prefix = `${userId}/${this.sanitizePath(projectName)}/${this.sanitizePath(templateName)}/`;

    try {
      const result = await this.s3Service.listObjects(this.bucketName, {
        prefix,
        maxKeys: 100
      });

      const versions: TemplateVersion[] = [];

      for (const obj of result.objects) {
        if (obj.key.includes('.v') && obj.key.endsWith('.json')) {
          const versionMatch = obj.key.match(/\.v(\d+)\.json$/);
          if (versionMatch) {
            versions.push({
              version: parseInt(versionMatch[1]),
              createdAt: obj.lastModified?.toISOString() || new Date().toISOString(),
              createdBy: userId,
              size: obj.size || 0
            });
          }
        }
      }

      return versions.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Error getting versions:', error);
      return [];
    }
  }

  /**
   * Archive a version
   */
  private async archiveVersion(userId: string, projectName: string, templateName: string, version: number): Promise<void> {
    const sourceKey = this.getTemplateKey(userId, projectName, templateName);
    const destKey = this.getTemplateKey(userId, projectName, templateName, version);

    try {
      await this.s3Service.copyObject(this.bucketName, sourceKey, this.bucketName, destKey);
    } catch (error) {
      console.error('Error archiving version:', error);
    }
  }

  /**
   * Clean up old versions beyond the limit
   */
  private async cleanupOldVersions(userId: string, projectName: string, templateName: string): Promise<void> {
    const versions = await this.getVersions(userId, projectName, templateName);

    if (versions.length > this.maxVersions) {
      const versionsToDelete = versions.slice(this.maxVersions);

      for (const version of versionsToDelete) {
        const key = this.getTemplateKey(userId, projectName, templateName, version.version);
        try {
          await this.s3Service.deleteObject(this.bucketName, key);
        } catch (error) {
          console.error(`Error deleting old version ${version.version}:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const templateStorageService = new TemplateStorageService();