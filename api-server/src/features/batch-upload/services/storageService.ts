import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { SeaweedFSUploadResult, BatchUploadError } from '../types';
import { sanitizeEmailForPath, sanitizeFileName } from '../validators/batchValidators';

export class StorageService {
  private s3Client: S3Client | null = null;
  private useLocalStorage: boolean;
  private localStoragePath: string;
  private bucket: string;

  constructor() {
    this.useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';
    this.localStoragePath = process.env.LOCAL_STORAGE_PATH || '/app/uploads';
    this.bucket = process.env.SEAWEEDFS_BUCKET || 'repositories';

    if (!this.useLocalStorage) {
      this.initializeS3Client();
    }
  }

  private initializeS3Client(): void {
    const endpoint = process.env.SEAWEEDFS_ENDPOINT;
    const accessKeyId = process.env.SEAWEEDFS_ACCESS_KEY;
    const secretAccessKey = process.env.SEAWEEDFS_SECRET_KEY;
    const region = process.env.SEAWEEDFS_REGION || 'us-east-1';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn('SeaweedFS credentials not configured. Using local storage fallback.');
      this.useLocalStorage = true;
      return;
    }

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for S3-compatible storage like SeaweedFS
    });
  }

  async uploadBatchFile(
    file: Express.Multer.File,
    userEmail: string,
    projectName: string
  ): Promise<SeaweedFSUploadResult> {
    const sanitizedEmail = sanitizeEmailForPath(userEmail);
    const sanitizedProjectName = sanitizeEmailForPath(projectName); // Reuse same sanitization
    const sanitizedFileName = sanitizeFileName(file.originalname);

    // Add timestamp to filename for uniqueness (allows multiple uploads of same file)
    const timestamp = Date.now();
    const lastDotIndex = sanitizedFileName.lastIndexOf('.');
    const fileExtension = lastDotIndex > 0 ? sanitizedFileName.substring(lastDotIndex) : '';
    const fileBaseName = lastDotIndex > 0 ? sanitizedFileName.substring(0, lastDotIndex) : sanitizedFileName;
    const uniqueFileName = `${fileBaseName}-${timestamp}${fileExtension}`;

    // Path structure: batches/{sanitizedEmail}/{sanitizedProjectName}/{uniqueFileName}
    // Note: Do NOT include 'buckets/' prefix - that's the bucket name in S3
    const filePath = `batches/${sanitizedEmail}/${sanitizedProjectName}/${uniqueFileName}`;

    try {
      if (this.useLocalStorage) {
        return await this.uploadToLocalStorage(file, filePath);
      } else {
        return await this.uploadToSeaweedFS(file, filePath);
      }
    } catch (error) {
      console.error('Storage upload error:', error);
      throw new BatchUploadError(
        'Failed to upload file to storage',
        'STORAGE_UPLOAD_ERROR',
        500
      );
    }
  }

  private async uploadToLocalStorage(
    file: Express.Multer.File,
    filePath: string
  ): Promise<SeaweedFSUploadResult> {
    const fullPath = path.join(this.localStoragePath, filePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file to local storage
    await fs.writeFile(fullPath, file.buffer);

    return {
      filePath,
      url: `file://${fullPath}`,
      size: file.size,
    };
  }

  private async uploadToSeaweedFS(
    file: Express.Multer.File,
    filePath: string
  ): Promise<SeaweedFSUploadResult> {
    if (!this.s3Client) {
      throw new BatchUploadError(
        'SeaweedFS client not initialized',
        'STORAGE_NOT_INITIALIZED',
        500
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);

    const url = `${process.env.SEAWEEDFS_ENDPOINT}/${this.bucket}/${filePath}`;

    return {
      filePath,
      url,
      size: file.size,
    };
  }

  async getFile(filePath: string): Promise<Buffer> {
    try {
      if (this.useLocalStorage) {
        return await this.getFromLocalStorage(filePath);
      } else {
        return await this.getFromSeaweedFS(filePath);
      }
    } catch (error) {
      console.error('Storage retrieval error:', error);
      throw new BatchUploadError(
        'Failed to retrieve file from storage',
        'STORAGE_RETRIEVAL_ERROR',
        500
      );
    }
  }

  private async getFromLocalStorage(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.localStoragePath, filePath);
    return await fs.readFile(fullPath);
  }

  private async getFromSeaweedFS(filePath: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new BatchUploadError(
        'SeaweedFS client not initialized',
        'STORAGE_NOT_INITIALIZED',
        500
      );
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new BatchUploadError(
        'File not found in storage',
        'FILE_NOT_FOUND',
        404
      );
    }

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (this.useLocalStorage) {
        await this.deleteFromLocalStorage(filePath);
      } else {
        await this.deleteFromSeaweedFS(filePath);
      }
    } catch (error) {
      console.error('Storage deletion error:', error);
      // Log but don't throw - deletion errors shouldn't break the flow
    }
  }

  private async deleteFromLocalStorage(filePath: string): Promise<void> {
    const fullPath = path.join(this.localStoragePath, filePath);
    await fs.unlink(fullPath);
  }

  private async deleteFromSeaweedFS(filePath: string): Promise<void> {
    if (!this.s3Client) {
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });

    await this.s3Client.send(command);
  }
}

// Export singleton instance
export const storageService = new StorageService();