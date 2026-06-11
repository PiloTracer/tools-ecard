# S3-Bucket Feature Implementation Guide

## Overview

This guide provides step-by-step instructions for integrating the s3-bucket feature into other features in the E-Cards application. The s3-bucket feature provides S3-compatible storage using SeaweedFS for handling all file operations.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Integration](#basic-integration)
3. [Feature-Specific Integration Examples](#feature-specific-integration-examples)
4. [Frontend Integration](#frontend-integration)
5. [Advanced Patterns](#advanced-patterns)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Quick Start

### Step 1: Import the S3 Service

```typescript
// In your feature's service file
import { s3Service } from '@/features/s3-bucket';
```

### Step 2: Use S3 Operations

```typescript
// Upload a file
const result = await s3Service.putObject('my-bucket', 'path/to/file.png', buffer, {
  contentType: 'image/png'
});

// Download a file
const file = await s3Service.getObject('my-bucket', 'path/to/file.png');

// Delete a file
await s3Service.deleteObject('my-bucket', 'path/to/file.png');
```

### Step 3: Handle the Response

```typescript
// result contains: { etag, versionId, publicUrl }
console.log('File uploaded:', result.publicUrl);
```

---

## Basic Integration

### Backend (API Server)

#### 1. Create a Service Method

```typescript
// api-server/src/features/your-feature/services/yourService.ts

import { s3Service } from '@/features/s3-bucket';
import type { PutObjectResult } from '@/features/s3-bucket';

export const yourService = {
  async uploadAsset(
    featureId: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    // Define bucket and key
    const bucket = 'your-feature-assets';
    const key = `${featureId}/${Date.now()}-${fileName}`;

    // Upload to S3
    const result: PutObjectResult = await s3Service.putObject(
      bucket,
      key,
      fileBuffer,
      {
        contentType,
        metadata: {
          featureId,
          uploadedAt: new Date().toISOString(),
          originalName: fileName
        }
      }
    );

    // Return public URL
    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  async downloadAsset(featureId: string, fileName: string): Promise<Buffer> {
    const bucket = 'your-feature-assets';
    const key = `${featureId}/${fileName}`;

    const { data } = await s3Service.getObject(bucket, key);

    // Convert stream to buffer if needed
    if (Buffer.isBuffer(data)) {
      return data;
    }

    // Handle stream
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },

  async deleteAsset(featureId: string, fileName: string): Promise<void> {
    const bucket = 'your-feature-assets';
    const key = `${featureId}/${fileName}`;
    await s3Service.deleteObject(bucket, key);
  }
};
```

#### 2. Create a Controller

```typescript
// api-server/src/features/your-feature/controllers/assetController.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import { yourService } from '../services/yourService';

interface UploadRequest extends FastifyRequest {
  body: {
    featureId: string;
    fileName: string;
  };
}

export const assetController = {
  async uploadAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Get file from multipart upload
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const { featureId } = request.body as any;

      // Upload to S3
      const publicUrl = await yourService.uploadAsset(
        featureId,
        data.filename,
        buffer,
        data.mimetype
      );

      return reply.send({
        success: true,
        url: publicUrl,
        filename: data.filename
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      return reply.status(500).send({ error: error.message });
    }
  },

  async downloadAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { featureId, fileName } = request.params as any;

      const fileBuffer = await yourService.downloadAsset(featureId, fileName);

      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

      return reply.send(fileBuffer);
    } catch (error: any) {
      console.error('Download error:', error);
      return reply.status(500).send({ error: error.message });
    }
  },

  async deleteAsset(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { featureId, fileName } = request.params as any;

      await yourService.deleteAsset(featureId, fileName);

      return reply.send({ success: true });
    } catch (error: any) {
      console.error('Delete error:', error);
      return reply.status(500).send({ error: error.message });
    }
  }
};
```

#### 3. Register Routes

```typescript
// api-server/src/features/your-feature/routes.ts

import type { FastifyInstance } from 'fastify';
import { assetController } from './controllers/assetController';

export async function yourFeatureRoutes(app: FastifyInstance) {
  // Upload asset
  app.post('/upload', assetController.uploadAsset);

  // Download asset
  app.get('/:featureId/:fileName', assetController.downloadAsset);

  // Delete asset
  app.delete('/:featureId/:fileName', assetController.deleteAsset);
}
```

---

## Feature-Specific Integration Examples

### Template Designer Feature

```typescript
// api-server/src/features/template-designer/services/templateAssetService.ts

import { s3Service } from '@/features/s3-bucket';

export const templateAssetService = {
  /**
   * Upload template background image
   */
  async uploadBackground(
    templateId: string,
    imageBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const bucket = 'templates';
    const key = `${templateId}/background.${contentType.split('/')[1]}`;

    const result = await s3Service.putObject(bucket, key, imageBuffer, {
      contentType,
      metadata: {
        templateId,
        type: 'background',
        uploadedAt: new Date().toISOString()
      }
    });

    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  /**
   * Upload template logo
   */
  async uploadLogo(
    templateId: string,
    logoBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const bucket = 'templates';
    const key = `${templateId}/logo.${contentType.split('/')[1]}`;

    const result = await s3Service.putObject(bucket, key, logoBuffer, {
      contentType,
      metadata: {
        templateId,
        type: 'logo',
        uploadedAt: new Date().toISOString()
      }
    });

    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  /**
   * List all assets for a template
   */
  async listTemplateAssets(templateId: string) {
    const bucket = 'templates';
    const prefix = `${templateId}/`;

    const result = await s3Service.listObjects(bucket, {
      prefix,
      maxKeys: 100
    });

    return result.objects;
  },

  /**
   * Delete all template assets
   */
  async deleteTemplateAssets(templateId: string): Promise<void> {
    const bucket = 'templates';
    const assets = await this.listTemplateAssets(templateId);

    if (assets.length === 0) return;

    // Delete in batch
    const keys = assets.map(asset => asset.key);
    await s3Service.deleteObjects(bucket, keys);
  }
};
```

### Batch Management Feature

```typescript
// api-server/src/features/batch-management/services/batchStorageService.ts

import { s3Service } from '@/features/s3-bucket';

export const batchStorageService = {
  /**
   * Save rendered card to storage
   */
  async saveRenderedCard(
    batchId: string,
    cardId: string,
    imageBuffer: Buffer
  ): Promise<string> {
    const bucket = 'batches';
    const key = `${batchId}/cards/${cardId}.png`;

    const result = await s3Service.putObject(bucket, key, imageBuffer, {
      contentType: 'image/png',
      metadata: {
        batchId,
        cardId,
        renderedAt: new Date().toISOString()
      }
    });

    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  /**
   * Get download URL for a card (presigned for security)
   */
  async getCardDownloadUrl(
    batchId: string,
    cardId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucket = 'batches';
    const key = `${batchId}/cards/${cardId}.png`;

    return await s3Service.generatePresignedUrl(bucket, key, expiresIn);
  },

  /**
   * Create batch archive (ZIP)
   */
  async saveBatchArchive(
    batchId: string,
    zipBuffer: Buffer
  ): Promise<string> {
    const bucket = 'batches';
    const key = `${batchId}/archive.zip`;

    const result = await s3Service.putObject(bucket, key, zipBuffer, {
      contentType: 'application/zip',
      metadata: {
        batchId,
        archivedAt: new Date().toISOString()
      }
    });

    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  /**
   * Get batch archive download URL
   */
  async getBatchArchiveUrl(
    batchId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucket = 'batches';
    const key = `${batchId}/archive.zip`;

    return await s3Service.generatePresignedUrl(bucket, key, expiresIn);
  },

  /**
   * Delete entire batch
   */
  async deleteBatch(batchId: string): Promise<void> {
    const bucket = 'batches';
    const prefix = `${batchId}/`;

    // List all objects in batch
    const { objects } = await s3Service.listObjects(bucket, { prefix });

    if (objects.length === 0) return;

    // Delete all objects
    const keys = objects.map(obj => obj.key);
    await s3Service.deleteObjects(bucket, keys);
  }
};
```

### User Profile Feature

```typescript
// api-server/src/features/user-profile/services/profileStorageService.ts

import { s3Service } from '@/features/s3-bucket';

export const profileStorageService = {
  /**
   * Upload user profile picture
   */
  async uploadProfilePicture(
    userId: string,
    imageBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    const bucket = 'user-profiles';
    const extension = contentType.split('/')[1];
    const key = `${userId}/profile.${extension}`;

    const result = await s3Service.putObject(bucket, key, imageBuffer, {
      contentType,
      metadata: {
        userId,
        uploadedAt: new Date().toISOString()
      }
    });

    return result.publicUrl || s3Service.getPublicUrl(bucket, key);
  },

  /**
   * Get profile picture URL
   */
  getProfilePictureUrl(userId: string, extension: string = 'jpg'): string {
    const bucket = 'user-profiles';
    const key = `${userId}/profile.${extension}`;
    return s3Service.getPublicUrl(bucket, key);
  },

  /**
   * Delete profile picture
   */
  async deleteProfilePicture(userId: string, extension: string = 'jpg'): Promise<void> {
    const bucket = 'user-profiles';
    const key = `${userId}/profile.${extension}`;
    await s3Service.deleteObject(bucket, key);
  }
};
```

---

## Frontend Integration

### Upload File from Frontend

```typescript
// front-cards/features/your-feature/services/uploadService.ts

export class UploadService {
  private apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

  async uploadFile(
    featureId: string,
    file: File
  ): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('featureId', featureId);

    const response = await fetch(`${this.apiUrl}/api/v1/your-feature/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return await response.json();
  }

  async deleteFile(featureId: string, fileName: string): Promise<void> {
    const response = await fetch(
      `${this.apiUrl}/api/v1/your-feature/${featureId}/${fileName}`,
      {
        method: 'DELETE',
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error('Delete failed');
    }
  }

  getFileUrl(featureId: string, fileName: string): string {
    return `${this.apiUrl}/api/v1/your-feature/${featureId}/${fileName}`;
  }
}

export const uploadService = new UploadService();
```

### React Component Example

```typescript
// front-cards/features/your-feature/components/FileUploader.tsx

'use client';

import { useState } from 'react';
import { uploadService } from '../services/uploadService';

interface FileUploaderProps {
  featureId: string;
  onUploadComplete?: (url: string) => void;
}

export function FileUploader({ featureId, onUploadComplete }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadService.uploadFile(featureId, file);
      setFileUrl(result.url);
      onUploadComplete?.(result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer"
      />

      {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {fileUrl && (
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">Upload successful!</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View file
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## Advanced Patterns

### Multipart Upload for Large Files

```typescript
// For files larger than 10MB, use multipart upload

export const largeFileService = {
  async uploadLargeFile(
    bucket: string,
    key: string,
    fileBuffer: Buffer,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const fileSize = fileBuffer.length;
    const threshold = 10 * 1024 * 1024; // 10MB

    if (fileSize <= threshold) {
      // Use regular upload
      const result = await s3Service.putObject(bucket, key, fileBuffer);
      return result.publicUrl || s3Service.getPublicUrl(bucket, key);
    }

    // Use multipart upload
    const chunkSize = 5 * 1024 * 1024; // 5MB per part
    const numParts = Math.ceil(fileSize / chunkSize);

    // Initiate multipart upload
    const { uploadId } = await s3Service.createMultipartUpload(bucket, key);

    try {
      const uploadedParts: Array<{ partNumber: number; etag: string }> = [];

      // Upload each part
      for (let i = 0; i < numParts; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = fileBuffer.slice(start, end);

        const { etag } = await s3Service.uploadPart(
          bucket,
          key,
          uploadId,
          i + 1,
          chunk
        );

        uploadedParts.push({ partNumber: i + 1, etag });

        // Report progress
        if (onProgress) {
          const progress = ((i + 1) / numParts) * 100;
          onProgress(progress);
        }
      }

      // Complete multipart upload
      await s3Service.completeMultipartUpload(
        bucket,
        key,
        uploadId,
        uploadedParts
      );

      return s3Service.getPublicUrl(bucket, key);
    } catch (error) {
      // Abort on error
      await s3Service.abortMultipartUpload(bucket, key, uploadId);
      throw error;
    }
  }
};
```

### Streaming Large Files

```typescript
// Stream large files to avoid loading into memory

import { pipeline } from 'stream/promises';
import type { FastifyReply } from 'fastify';

export const streamingService = {
  async streamFile(
    bucket: string,
    key: string,
    reply: FastifyReply
  ): Promise<void> {
    const { data, metadata } = await s3Service.getObject(bucket, key);

    // Set headers
    reply.header('Content-Type', metadata.contentType || 'application/octet-stream');
    reply.header('Content-Length', metadata.contentLength?.toString() || '0');

    // Stream to response
    if (Buffer.isBuffer(data)) {
      return reply.send(data);
    }

    // Pipe stream
    await pipeline(data, reply.raw);
  }
};
```

### Presigned URLs for Secure Access

```typescript
// Generate temporary URLs for secure file access

export const secureAccessService = {
  /**
   * Generate temporary download URL
   */
  async getTemporaryDownloadUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    return await s3Service.generatePresignedUrl(bucket, key, expiresIn);
  },

  /**
   * Generate temporary upload URL (for direct browser upload)
   */
  async getTemporaryUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return await s3Service.generatePresignedUrl(
      bucket,
      key,
      expiresIn,
      'putObject',
      { contentType }
    );
  }
};
```

---

## Error Handling

### Standard Error Handling Pattern

```typescript
import { S3Error } from '@/features/s3-bucket';

export const safeUploadService = {
  async uploadWithErrorHandling(
    bucket: string,
    key: string,
    data: Buffer
  ): Promise<string | null> {
    try {
      const result = await s3Service.putObject(bucket, key, data);
      return result.publicUrl || s3Service.getPublicUrl(bucket, key);
    } catch (error) {
      if (error instanceof S3Error) {
        // Handle S3-specific errors
        console.error('S3 Error:', {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode
        });

        // Handle specific error codes
        switch (error.code) {
          case 'NoSuchBucket':
            console.error('Bucket does not exist');
            break;
          case 'AccessDenied':
            console.error('Access denied to S3');
            break;
          case 'EntityTooLarge':
            console.error('File is too large');
            break;
          default:
            console.error('Unknown S3 error');
        }
      } else {
        console.error('Unexpected error:', error);
      }

      return null;
    }
  }
};
```

---

## Testing

### Unit Test Example

```typescript
// __tests__/templateAssetService.test.ts

import { templateAssetService } from '../services/templateAssetService';
import { s3Service } from '@/features/s3-bucket';

jest.mock('@/features/s3-bucket');

describe('TemplateAssetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload background image', async () => {
    const mockResult = {
      etag: 'abc123',
      publicUrl: 'http://storage/templates/123/background.png'
    };

    (s3Service.putObject as jest.Mock).mockResolvedValue(mockResult);

    const buffer = Buffer.from('fake image data');
    const url = await templateAssetService.uploadBackground('123', buffer, 'image/png');

    expect(s3Service.putObject).toHaveBeenCalledWith(
      'templates',
      '123/background.png',
      buffer,
      expect.objectContaining({
        contentType: 'image/png'
      })
    );

    expect(url).toBe(mockResult.publicUrl);
  });

  it('should delete template assets', async () => {
    const mockAssets = [
      { key: '123/background.png' },
      { key: '123/logo.png' }
    ];

    (s3Service.listObjects as jest.Mock).mockResolvedValue({
      objects: mockAssets
    });

    await templateAssetService.deleteTemplateAssets('123');

    expect(s3Service.deleteObjects).toHaveBeenCalledWith(
      'templates',
      ['123/background.png', '123/logo.png']
    );
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/s3Upload.test.ts

describe('S3 Upload Integration', () => {
  it('should upload and retrieve file', async () => {
    const bucket = 'test-bucket';
    const key = 'test-file.txt';
    const content = Buffer.from('Hello World');

    // Upload
    const uploadResult = await s3Service.putObject(bucket, key, content);
    expect(uploadResult.etag).toBeDefined();

    // Retrieve
    const { data } = await s3Service.getObject(bucket, key);
    const retrieved = Buffer.isBuffer(data) ? data : await streamToBuffer(data);

    expect(retrieved.toString()).toBe('Hello World');

    // Cleanup
    await s3Service.deleteObject(bucket, key);
  });
});
```

---

## Best Practices

### 1. Bucket Organization

```
✅ Good:
- templates/{templateId}/background.png
- batches/{batchId}/cards/{cardId}.png
- users/{userId}/profile.jpg

❌ Bad:
- all-files/random-uuid.png
- uploads/file123.png
```

### 2. File Validation

```typescript
export function validateFile(file: Express.Multer.File) {
  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type');
  }

  // Check file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large');
  }

  // Check dimensions (for images)
  // ... add image dimension validation if needed
}
```

### 3. Use Presigned URLs for Client Downloads

```typescript
// ✅ Good: Generate presigned URL
const url = await s3Service.generatePresignedUrl(bucket, key, 3600);
res.json({ downloadUrl: url });

// ❌ Bad: Stream through API server (wastes bandwidth)
const { data } = await s3Service.getObject(bucket, key);
res.send(data);
```

### 4. Clean Up Failed Uploads

```typescript
export async function cleanupOrphanedUploads() {
  const bucket = 'your-bucket';

  // List incomplete multipart uploads
  const uploads = await s3Service.listMultipartUploads(bucket);

  // Abort uploads older than 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const upload of uploads) {
    if (upload.initiated < oneDayAgo) {
      await s3Service.abortMultipartUpload(bucket, upload.key, upload.uploadId);
    }
  }
}
```

### 5. Monitor Storage Usage

```typescript
export async function getStorageUsage(bucket: string, prefix?: string) {
  const { objects } = await s3Service.listObjects(bucket, { prefix });

  const totalSize = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
  const totalFiles = objects.length;

  return {
    totalSize,
    totalFiles,
    totalSizeInMB: (totalSize / 1024 / 1024).toFixed(2)
  };
}
```

### 6. Use Appropriate Content Types

```typescript
import mime from 'mime-types';

const contentType = mime.lookup(fileName) || 'application/octet-stream';

await s3Service.putObject(bucket, key, buffer, {
  contentType,
  cacheControl: 'public, max-age=31536000' // Cache for 1 year
});
```

---

## Troubleshooting

### Issue: Connection Timeout

**Cause:** SeaweedFS endpoint is unreachable or slow

**Solution:**
```typescript
// Increase timeout in s3Config
const config = {
  requestTimeout: 30000, // 30 seconds
  maxRetries: 3
};
```

### Issue: Access Denied

**Cause:** Invalid credentials or missing bucket permissions

**Solution:**
```bash
# Verify credentials in .env
SEAWEEDFS_ACCESS_KEY=your_key
SEAWEEDFS_SECRET_KEY=your_secret

# Create bucket if missing
await s3Service.createBucket('your-bucket');
```

### Issue: Large File Upload Fails

**Cause:** File exceeds single-part upload limit

**Solution:**
```typescript
// Use multipart upload for files > 10MB
if (fileSize > 10 * 1024 * 1024) {
  await largeFileService.uploadLargeFile(bucket, key, buffer);
}
```

---

## Summary Checklist

When integrating s3-bucket into a new feature:

- [ ] Import `s3Service` from `@/features/s3-bucket`
- [ ] Define bucket name and key structure
- [ ] Create service methods for upload/download/delete
- [ ] Add proper error handling with try/catch
- [ ] Validate files before upload (type, size)
- [ ] Use presigned URLs for secure downloads
- [ ] Add frontend upload component if needed
- [ ] Write unit tests for service methods
- [ ] Test multipart upload for large files
- [ ] Document bucket structure and usage
- [ ] Monitor storage usage

---

## Additional Resources

- **Full Feature Spec:** `.claude/features/s3-bucket.md`
- **Implementation Plan:** `.claude/plans/s3-bucket-plan.md`
- **Agent Quick Start:** `.claude/prompts/s3-bucket-prompt.md`
- **Feature README:** `api-server/src/features/s3-bucket/README.md`
- **SeaweedFS S3 API:** https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API
