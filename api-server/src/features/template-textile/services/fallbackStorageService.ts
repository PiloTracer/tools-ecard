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
      path.join(this.basePath, 'users'),
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
    userId: string,
    projectId: string,
    templateId: string,
    template: any
  ): Promise<string> {
    const templatePath = this.getTemplatePath(userId, projectId, templateId);
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
    userId: string,
    projectId: string,
    templateId: string
  ): Promise<any | null> {
    try {
      const templatePath = this.getTemplatePath(userId, projectId, templateId);
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
   * Save resource to local storage
   */
  async saveResource(
    userId: string,
    resource: Buffer | Uint8Array,
    hash: string,
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

    const resourcePath = this.getResourcePath(userId, hash);
    const dir = path.dirname(resourcePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

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
   * Load resource from local storage
   */
  async loadResource(userId: string, hash: string): Promise<Buffer | null> {
    try {
      const resourcePath = this.getResourcePath(userId, hash);
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
    userId: string,
    hash: string
  ): Promise<{ originalName?: string; mimeType?: string } | null> {
    try {
      const metadataPath = `${this.getResourcePath(userId, hash)}.meta`;
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
    userId: string,
    projectId: string,
    templateId: string
  ): Promise<void> {
    const templateDir = path.dirname(this.getTemplatePath(userId, projectId, templateId));

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
  async deleteResource(userId: string, hash: string): Promise<void> {
    const resourcePath = this.getResourcePath(userId, hash);
    const metadataPath = `${resourcePath}.meta`;

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
   * Calculate storage usage for a user
   */
  async calculateStorageUsage(userId: string): Promise<{
    templates: number;
    resources: number;
    total: number;
    fileCount: number;
  }> {
    let templatesSize = 0;
    let resourcesSize = 0;
    let fileCount = 0;

    // Calculate templates size
    const templates = await this.listTemplates(userId);
    for (const template of templates) {
      templatesSize += template.size;
      fileCount++;
    }

    // Calculate resources size
    const resourcesPath = path.join(this.basePath, 'resources', this.sanitizePath(userId));

    try {
      const resources = await this.walkDirectory(resourcesPath);
      for (const file of resources) {
        const stats = await fs.stat(file);
        if (stats.isFile() && !file.endsWith('.meta')) {
          resourcesSize += stats.size;
          fileCount++;
        }
      }
    } catch {
      // Resources directory might not exist
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
  createReadStream(userId: string, hash: string): NodeJS.ReadableStream {
    const resourcePath = this.getResourcePath(userId, hash);
    const fs = require('fs');
    return fs.createReadStream(resourcePath);
  }

  /**
   * Create a writable stream for a resource
   */
  createWriteStream(
    userId: string,
    hash: string
  ): NodeJS.WritableStream {
    const resourcePath = this.getResourcePath(userId, hash);
    const dir = path.dirname(resourcePath);
    const fs = require('fs');

    // Ensure directory exists synchronously
    require('fs').mkdirSync(dir, { recursive: true });

    return fs.createWriteStream(resourcePath);
  }

  /**
   * Get template path
   */
  private getTemplatePath(
    userId: string,
    projectId: string,
    templateId: string
  ): string {
    return path.join(
      this.basePath,
      'users',
      this.sanitizePath(userId),
      this.sanitizePath(projectId),
      'templates',
      this.sanitizePath(templateId),
      'template.json'
    );
  }

  /**
   * Get resource path
   */
  private getResourcePath(userId: string, hash: string): string {
    // Use first 2 chars of hash for directory sharding
    const shard = hash.substring(0, 2);
    return path.join(
      this.basePath,
      'resources',
      this.sanitizePath(userId),
      shard,
      hash
    );
  }

  /**
   * Sanitize path component
   */
  private sanitizePath(component: string): string {
    return component
      .replace(/[^a-zA-Z0-9-_]/g, '')
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
    userId: string,
    hash: string,
    expectedHash?: string
  ): Promise<boolean> {
    const content = await this.loadResource(userId, hash);

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