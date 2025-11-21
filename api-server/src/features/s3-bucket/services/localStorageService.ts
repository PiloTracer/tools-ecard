/**
 * Local Storage Service - Fallback for Development
 *
 * This service provides local file system storage as a fallback when
 * SeaweedFS is not available. It implements the same interface as S3Service
 * to ensure compatibility.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import {
  type IS3Service,
  type ObjectMetadata,
  type PutObjectResult,
  type GetObjectResult,
  type HeadObjectResult,
  type ListObjectsOptions,
  type ListObjectsResult,
  type ListBucketsResult,
  type CreateMultipartResult,
  type UploadPartResult,
  type CompletedPart,
  type CompleteMultipartResult,
  type S3Object,
  type S3Bucket,
  BucketNotFoundError,
  ObjectNotFoundError,
  InvalidRequestError
} from '../types';

export class LocalStorageService implements IS3Service {
  private storageRoot: string;
  private multipartUploads: Map<string, { parts: Map<number, string> }> = new Map();

  constructor(storageRoot?: string) {
    // Use local storage directory in project root
    this.storageRoot = storageRoot || path.join(process.cwd(), '.local-storage');
    this.ensureStorageRoot();
  }

  private async ensureStorageRoot(): Promise<void> {
    try {
      await fs.access(this.storageRoot);
    } catch {
      await fs.mkdir(this.storageRoot, { recursive: true });
      console.log(`Created local storage directory: ${this.storageRoot}`);
    }
  }

  private getBucketPath(bucket: string): string {
    return path.join(this.storageRoot, bucket);
  }

  private getObjectPath(bucket: string, key: string): string {
    return path.join(this.storageRoot, bucket, key);
  }

  private getMetadataPath(bucket: string, key: string): string {
    return path.join(this.storageRoot, bucket, `${key}.metadata.json`);
  }

  // ============================================================================
  // Object Operations
  // ============================================================================

  async putObject(
    bucket: string,
    key: string,
    data: Buffer | Readable | string,
    metadata?: ObjectMetadata
  ): Promise<PutObjectResult> {
    const objectPath = this.getObjectPath(bucket, key);
    const metadataPath = this.getMetadataPath(bucket, key);

    // Ensure bucket and parent directories exist
    await fs.mkdir(path.dirname(objectPath), { recursive: true });

    // Write data
    if (Buffer.isBuffer(data)) {
      await fs.writeFile(objectPath, data);
    } else if (typeof data === 'string') {
      await fs.writeFile(objectPath, data, 'utf-8');
    } else if (data instanceof Readable) {
      const writeStream = createWriteStream(objectPath);
      await pipeline(data, writeStream);
    }

    // Save metadata
    if (metadata) {
      await fs.writeFile(metadataPath, JSON.stringify({
        ...metadata,
        lastModified: new Date().toISOString(),
        etag: Date.now().toString(36)
      }, null, 2));
    }

    const stats = await fs.stat(objectPath);
    const etag = `"${stats.mtime.getTime().toString(36)}"`;

    console.log(`Stored object locally: ${bucket}/${key}`);

    return {
      etag,
      bucket,
      key,
      location: `file://${objectPath}`
    };
  }

  async getObject(bucket: string, key: string): Promise<GetObjectResult> {
    const objectPath = this.getObjectPath(bucket, key);
    const metadataPath = this.getMetadataPath(bucket, key);

    try {
      await fs.access(objectPath);
    } catch {
      throw new ObjectNotFoundError(bucket, key);
    }

    const stats = await fs.stat(objectPath);
    const body = createReadStream(objectPath) as unknown as Readable;

    // Load metadata if exists
    let metadata: any = {};
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } catch {
      // No metadata file
    }

    return {
      body,
      contentType: metadata.contentType || 'application/octet-stream',
      contentLength: stats.size,
      lastModified: stats.mtime,
      etag: `"${stats.mtime.getTime().toString(36)}"`,
      metadata: metadata.metadata
    };
  }

  async headObject(bucket: string, key: string): Promise<HeadObjectResult> {
    const objectPath = this.getObjectPath(bucket, key);

    try {
      const stats = await fs.stat(objectPath);

      // Load metadata if exists
      let metadata: any = {};
      try {
        const metadataPath = this.getMetadataPath(bucket, key);
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // No metadata file
      }

      return {
        exists: true,
        contentType: metadata.contentType || 'application/octet-stream',
        contentLength: stats.size,
        lastModified: stats.mtime,
        etag: `"${stats.mtime.getTime().toString(36)}"`,
        metadata: metadata.metadata
      };
    } catch {
      return { exists: false };
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const objectPath = this.getObjectPath(bucket, key);
    const metadataPath = this.getMetadataPath(bucket, key);

    try {
      await fs.unlink(objectPath);
      // Try to delete metadata file if exists
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Ignore if metadata doesn't exist
      }
      console.log(`Deleted object: ${bucket}/${key}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const key of keys) {
      try {
        await this.deleteObject(bucket, key);
        deleted.push(key);
      } catch {
        errors.push(key);
      }
    }

    return { deleted, errors };
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const bucketPath = this.getBucketPath(bucket);

    try {
      await fs.access(bucketPath);
    } catch {
      throw new BucketNotFoundError(bucket);
    }

    const objects: S3Object[] = [];
    const commonPrefixes: string[] = [];

    async function walkDir(dir: string, prefix: string = ''): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const key = path.join(prefix, entry.name).replace(/\\/g, '/');

        // Skip metadata files
        if (entry.name.endsWith('.metadata.json')) {
          continue;
        }

        // Apply prefix filter
        if (options?.prefix && !key.startsWith(options.prefix)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Handle delimiter
          if (options?.delimiter) {
            const relativeToPrefix = options.prefix ? key.slice(options.prefix.length) : key;
            const delimiterIndex = relativeToPrefix.indexOf(options.delimiter);

            if (delimiterIndex !== -1) {
              const commonPrefix = (options.prefix || '') + relativeToPrefix.slice(0, delimiterIndex + 1);
              if (!commonPrefixes.includes(commonPrefix)) {
                commonPrefixes.push(commonPrefix);
              }
              continue;
            }
          }

          // Recurse into subdirectory
          await walkDir(fullPath, key);
        } else {
          const stats = await fs.stat(fullPath);
          objects.push({
            key,
            lastModified: stats.mtime,
            etag: `"${stats.mtime.getTime().toString(36)}"`,
            size: stats.size,
            storageClass: 'STANDARD'
          });
        }
      }
    }

    await walkDir(bucketPath);

    // Apply maxKeys limit
    const maxKeys = options?.maxKeys || 1000;
    const truncatedObjects = objects.slice(0, maxKeys);

    return {
      objects: truncatedObjects,
      commonPrefixes,
      isTruncated: objects.length > maxKeys,
      keyCount: truncatedObjects.length
    };
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(bucket: string): Promise<void> {
    const bucketPath = this.getBucketPath(bucket);

    try {
      await fs.mkdir(bucketPath, { recursive: true });
      console.log(`Created local bucket: ${bucket}`);
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async listBuckets(): Promise<ListBucketsResult> {
    const entries = await fs.readdir(this.storageRoot, { withFileTypes: true });

    const buckets: S3Bucket[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const stats = await fs.stat(path.join(this.storageRoot, entry.name));
        buckets.push({
          name: entry.name,
          creationDate: stats.birthtime
        });
      }
    }

    return { buckets };
  }

  async deleteBucket(bucket: string): Promise<void> {
    const bucketPath = this.getBucketPath(bucket);

    try {
      // Check if bucket is empty
      const entries = await fs.readdir(bucketPath);
      if (entries.length > 0) {
        throw new InvalidRequestError('Bucket is not empty');
      }

      await fs.rmdir(bucketPath);
      console.log(`Deleted local bucket: ${bucket}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new BucketNotFoundError(bucket);
      }
      throw error;
    }
  }

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      const bucketPath = this.getBucketPath(bucket);
      await fs.access(bucketPath);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Multipart Upload Operations (Simplified for local storage)
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    metadata?: ObjectMetadata
  ): Promise<CreateMultipartResult> {
    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.multipartUploads.set(uploadId, { parts: new Map() });

    return { uploadId, bucket, key };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | Readable
  ): Promise<UploadPartResult> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw new InvalidRequestError('Invalid upload ID');
    }

    const partPath = path.join(this.storageRoot, '.multipart', uploadId, `part-${partNumber}`);
    await fs.mkdir(path.dirname(partPath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(partPath, data);
    } else {
      const writeStream = createWriteStream(partPath);
      await pipeline(data, writeStream);
    }

    const etag = `"part-${partNumber}-${Date.now().toString(36)}"`;
    upload.parts.set(partNumber, partPath);

    return { etag, partNumber };
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ): Promise<CompleteMultipartResult> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw new InvalidRequestError('Invalid upload ID');
    }

    const objectPath = this.getObjectPath(bucket, key);
    await fs.mkdir(path.dirname(objectPath), { recursive: true });

    // Concatenate all parts
    const writeStream = createWriteStream(objectPath);

    for (const part of parts.sort((a, b) => a.partNumber - b.partNumber)) {
      const partPath = upload.parts.get(part.partNumber);
      if (!partPath) {
        throw new InvalidRequestError(`Missing part ${part.partNumber}`);
      }

      const readStream = createReadStream(partPath);
      await pipeline(readStream, writeStream, { end: false });
    }

    writeStream.end();

    // Clean up multipart files
    const multipartDir = path.join(this.storageRoot, '.multipart', uploadId);
    await fs.rm(multipartDir, { recursive: true, force: true });
    this.multipartUploads.delete(uploadId);

    const stats = await fs.stat(objectPath);
    const etag = `"${stats.mtime.getTime().toString(36)}"`;

    return {
      location: `file://${objectPath}`,
      bucket,
      key,
      etag
    };
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      return;
    }

    // Clean up multipart files
    const multipartDir = path.join(this.storageRoot, '.multipart', uploadId);
    await fs.rm(multipartDir, { recursive: true, force: true });
    this.multipartUploads.delete(uploadId);
  }

  async listParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<{ parts: UploadPartResult[]; uploadId: string }> {
    const upload = this.multipartUploads.get(uploadId);
    if (!upload) {
      throw new InvalidRequestError('Invalid upload ID');
    }

    const parts: UploadPartResult[] = Array.from(upload.parts.entries()).map(([partNumber]) => ({
      etag: `"part-${partNumber}"`,
      partNumber
    }));

    return { parts, uploadId };
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  async generatePresignedUrl(
    operation: 'getObject' | 'putObject',
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // For local storage, return a file:// URL
    const objectPath = this.getObjectPath(bucket, key);
    return `file://${objectPath}`;
  }

  getPublicUrl(bucket: string, key: string): string {
    const objectPath = this.getObjectPath(bucket, key);
    return `file://${objectPath}`;
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string
  ): Promise<void> {
    const sourcePath = this.getObjectPath(sourceBucket, sourceKey);
    const destPath = this.getObjectPath(destBucket, destKey);

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);

    // Copy metadata if exists
    try {
      const sourceMetadataPath = this.getMetadataPath(sourceBucket, sourceKey);
      const destMetadataPath = this.getMetadataPath(destBucket, destKey);
      await fs.copyFile(sourceMetadataPath, destMetadataPath);
    } catch {
      // Ignore if no metadata
    }
  }

  // Advanced operations not needed for local storage
  async uploadLargeFile(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    metadata?: ObjectMetadata,
    onProgress?: (progress: number) => void
  ): Promise<PutObjectResult> {
    // For local storage, just use regular putObject
    return this.putObject(bucket, key, data, metadata);
  }
}