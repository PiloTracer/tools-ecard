/**
 * Fallback Storage Service
 * Provides local file system storage when SeaweedFS is unavailable
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

export interface FallbackStorageOptions {
  basePath?: string;
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
}

class FallbackStorageService {
  private basePath: string;
  private maxFileSize: number;
  private allowedMimeTypes: Set<string>;

  constructor(options: FallbackStorageOptions = {}) {
    this.basePath = path.resolve(options.basePath || '.local-storage');
    this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024; // 50MB default
    this.allowedMimeTypes = new Set(options.allowedMimeTypes || [
      'application/json',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'font/ttf',
      'font/otf',
      'font/woff',
      'font/woff2',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav'
    ]);

    this.ensureDirectoryStructure();
  }

  /**
   * Ensure directory structure exists
   */
  private async ensureDirectoryStructure(): Promise<void> {
    const directories = [
      this.basePath,
      path.join(this.basePath, 'templates'),
      path.join(this.basePath, 'resources'),
      path.join(this.basePath, 'temp')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Check if fallback storage is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.basePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save template to local storage
   */
  async saveTemplate(
    userEmail: string,
    projectName: string,
    templateName: string,
    template: any
  ): Promise<string> {
    const templatePath = this.getTemplatePath(userEmail, projectName, templateName);
    const dir = path.dirname(templatePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write template JSON
    const templateData = JSON.stringify(template, null, 2);
    await fs.writeFile(templatePath, templateData, 'utf-8');

    return templatePath;
  }

  /**
   * Load template from local storage
   */
  async loadTemplate(
    userEmail: string,
    projectName: string,
    templateName: string
  ): Promise<any | null> {
    try {
      const templatePath = this.getTemplatePath(userEmail, projectName, templateName);
      const data = await fs.readFile(templatePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Save resource in the same directory as template
   */
  async saveResourceWithTemplate(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string,
    resource: Buffer | Uint8Array,
    metadata?: {
      originalName?: string;
      mimeType?: string;
    }
  ): Promise<string> {
    // Validate size
    if (resource.length > this.maxFileSize) {
      throw new Error(`Resource exceeds maximum size of ${this.maxFileSize} bytes`);
    }

    // Validate mime type if provided
    if (metadata?.mimeType && !this.allowedMimeTypes.has(metadata.mimeType)) {
      throw new Error(`MIME type ${metadata.mimeType} is not allowed`);
    }

    // Get template directory path
    const templateDir = path.join(
      this.basePath,
      'templates',
      this.sanitizePath(userEmail),
      this.sanitizePath(projectName),
      this.sanitizePath(templateName)
    );

    const resourcePath = path.join(templateDir, resourceName);

    // Ensure directory exists
    await fs.mkdir(templateDir, { recursive: true });

    // Write resource data
    await fs.writeFile(resourcePath, resource);

    // Save metadata if provided
    if (metadata) {
      const metadataPath = `${resourcePath}.meta`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    return resourcePath;
  }

  /**
   * Save resource to local storage (deprecated - kept for compatibility)
   */
  async saveResource(
    userEmail: string,
    resource: Buffer | Uint8Array,
    resourceName: string,
    metadata?: {
      originalName?: string;
      mimeType?: string;
      projectName?: string;
      templateName?: string;
    }
  ): Promise<string> {
    // Validate size
    if (resource.length > this.maxFileSize) {
      throw new Error(`Resource exceeds maximum size of ${this.maxFileSize} bytes`);
    }

    // Validate mime type if provided
    if (metadata?.mimeType && !this.allowedMimeTypes.has(metadata.mimeType)) {
      throw new Error(`MIME type ${metadata.mimeType} is not allowed`);
    }

    // Context is required for proper path structure
    if (!metadata?.projectName || !metadata?.templateName) {
      throw new Error('Resource storage requires projectName and templateName in metadata');
    }

    return this.saveResourceWithTemplate(
      userEmail,
      metadata.projectName,
      metadata.templateName,
      resourceName,
      resource,
      metadata
    );
  }

  /**
   * Load resource from local storage (same directory as template)
   */
  async loadResource(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string
  ): Promise<Buffer | null> {
    try {
      const templateDir = path.join(
        this.basePath,
        'templates',
        this.sanitizePath(userEmail),
        this.sanitizePath(projectName),
        this.sanitizePath(templateName)
      );
      const resourcePath = path.join(templateDir, resourceName);
      return await fs.readFile(resourcePath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Get resource metadata
   */
  async getResourceMetadata(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string
  ): Promise<{ originalName?: string; mimeType?: string; projectName?: string; templateName?: string } | null> {
    try {
      const templateDir = path.join(
        this.basePath,
        'templates',
        this.sanitizePath(userEmail),
        this.sanitizePath(projectName),
        this.sanitizePath(templateName)
      );
      const metadataPath = path.join(templateDir, `${resourceName}.meta`);
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Delete template and its resources
   */
  async deleteTemplate(
    userEmail: string,
    projectName: string,
    templateName: string
  ): Promise<void> {
    const templateDir = path.dirname(this.getTemplatePath(userEmail, projectName, templateName));

    try {
      // Remove template directory and all its contents
      await fs.rm(templateDir, { recursive: true, force: true });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Delete resource
   */
  async deleteResource(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string
  ): Promise<void> {
    const templateDir = path.join(
      this.basePath,
      'templates',
      this.sanitizePath(userEmail),
      this.sanitizePath(projectName),
      this.sanitizePath(templateName)
    );
    const resourcePath = path.join(templateDir, resourceName);
    const metadataPath = path.join(templateDir, `${resourceName}.meta`);

    try {
      await fs.unlink(resourcePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      await fs.unlink(metadataPath);
    } catch {
      // Metadata might not exist, ignore
    }
  }

  /**
   * List templates for a user
   */
  async listTemplates(userId: string): Promise<Array<{
    projectId: string;
    templateId: string;
    path: string;
    size: number;
    modifiedAt: Date;
  }>> {
    const userPath = path.join(this.basePath, 'users', this.sanitizePath(userId));
    const templates: Array<{
      projectId: string;
      templateId: string;
      path: string;
      size: number;
      modifiedAt: Date;
    }> = [];

    try {
      // Read all project directories
      const projects = await fs.readdir(userPath);

      for (const projectId of projects) {
        const projectPath = path.join(userPath, projectId, 'templates');

        try {
          const templateDirs = await fs.readdir(projectPath);

          for (const templateId of templateDirs) {
            const templateFile = path.join(projectPath, templateId, 'template.json');

            try {
              const stats = await fs.stat(templateFile);
              templates.push({
                projectId,
                templateId,
                path: templateFile,
                size: stats.size,
                modifiedAt: stats.mtime
              });
            } catch {
              // Template file might not exist, skip
            }
          }
        } catch {
          // Project templates directory might not exist, skip
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }

    return templates;
  }

  /**
   * Calculate storage usage for a user (by sanitized email)
   */
  async calculateStorageUsage(userEmailOrId: string): Promise<{
    templates: number;
    resources: number;
    total: number;
    fileCount: number;
  }> {
    let templatesSize = 0;
    let resourcesSize = 0;
    let fileCount = 0;

    // Calculate templates and resources size - all stored together in templates directory
    // New structure: templates/{sanitizedEmail}/{project}/{template}/[template.json + resources]
    const sanitizedUser = this.sanitizePath(userEmailOrId);
    const userTemplatesPath = path.join(this.basePath, 'templates', sanitizedUser);

    try {
      const files = await this.walkDirectory(userTemplatesPath);
      for (const file of files) {
        const stats = await fs.stat(file);
        if (stats.isFile() && !file.endsWith('.meta')) {
          if (file.endsWith('template.json')) {
            templatesSize += stats.size;
          } else {
            resourcesSize += stats.size;
          }
          fileCount++;
        }
      }
    } catch {
      // Templates directory might not exist
    }

    return {
      templates: templatesSize,
      resources: resourcesSize,
      total: templatesSize + resourcesSize,
      fileCount
    };
  }

  /**
   * Clean up temporary files
   */
  async cleanupTemp(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const tempPath = path.join(this.basePath, 'temp');
    let deletedCount = 0;
    const cutoffTime = Date.now() - maxAge;

    try {
      const files = await fs.readdir(tempPath);

      for (const file of files) {
        const filePath = path.join(tempPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }

    return deletedCount;
  }

  /**
   * Create a readable stream for a resource
   */
  createReadStream(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string
  ): NodeJS.ReadableStream {
    const templateDir = path.join(
      this.basePath,
      'templates',
      this.sanitizePath(userEmail),
      this.sanitizePath(projectName),
      this.sanitizePath(templateName)
    );
    const resourcePath = path.join(templateDir, resourceName);
    const fs = require('fs');
    return fs.createReadStream(resourcePath);
  }

  /**
   * Create a writable stream for a resource
   */
  createWriteStream(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string
  ): NodeJS.WritableStream {
    const templateDir = path.join(
      this.basePath,
      'templates',
      this.sanitizePath(userEmail),
      this.sanitizePath(projectName),
      this.sanitizePath(templateName)
    );
    const resourcePath = path.join(templateDir, resourceName);
    const fs = require('fs');

    // Ensure directory exists synchronously
    require('fs').mkdirSync(templateDir, { recursive: true });

    return fs.createWriteStream(resourcePath);
  }

  /**
   * Get template path
   */
  private getTemplatePath(
    userEmail: string,
    projectName: string,
    templateName: string
  ): string {
    // Path structure: templates/{sanitizedEmail}/{sanitizedProject}/{sanitizedTemplate}/template.json
    return path.join(
      this.basePath,
      'templates',
      this.sanitizePath(userEmail),
      this.sanitizePath(projectName),
      this.sanitizePath(templateName),
      'template.json'
    );
  }

  /**
   * Sanitize path component (consistent with other services)
   */
  private sanitizePath(component: string): string {
    return component
      .toLowerCase()
      .replace(/@/g, '_at_')
      .replace(/\+/g, '')
      .replace(/\./g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 100);
  }

  /**
   * Walk directory recursively
   */
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory might not exist
    }

    return files;
  }

  /**
   * Calculate hash for content
   */
  calculateHash(content: Buffer | Uint8Array): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Verify resource integrity
   */
  async verifyResource(
    userEmail: string,
    projectName: string,
    templateName: string,
    resourceName: string,
    expectedHash?: string
  ): Promise<boolean> {
    const content = await this.loadResource(userEmail, projectName, templateName, resourceName);

    if (!content) {
      return false;
    }

    if (expectedHash) {
      const actualHash = this.calculateHash(content);
      return actualHash === expectedHash;
    }

    return true;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    available: boolean;
    basePath: string;
    totalUsers: number;
    totalTemplates: number;
    totalResources: number;
    totalSize: number;
  }> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        available: false,
        basePath: this.basePath,
        totalUsers: 0,
        totalTemplates: 0,
        totalResources: 0,
        totalSize: 0
      };
    }

    let totalUsers = 0;
    let totalTemplates = 0;
    let totalResources = 0;
    let totalSize = 0;

    // Count users
    const usersPath = path.join(this.basePath, 'users');
    try {
      const users = await fs.readdir(usersPath);
      totalUsers = users.length;

      // Count templates and calculate size for each user
      for (const userId of users) {
        const usage = await this.calculateStorageUsage(userId);
        totalTemplates += usage.fileCount;
        totalSize += usage.total;
      }
    } catch {
      // Users directory might not exist
    }

    // Count resources
    const resourcesPath = path.join(this.basePath, 'resources');
    try {
      const resources = await this.walkDirectory(resourcesPath);
      totalResources = resources.filter(f => !f.endsWith('.meta')).length;
    } catch {
      // Resources directory might not exist
    }

    return {
      available,
      basePath: this.basePath,
      totalUsers,
      totalTemplates,
      totalResources,
      totalSize
    };
  }
}

// Export singleton instance
export const fallbackStorageService = new FallbackStorageService();

// Export class for custom instances
export { FallbackStorageService };