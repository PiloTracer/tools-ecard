/**
 * S3 Service Implementation for SeaweedFS Integration
 *
 * This service provides all S3-compatible operations for interacting with
 * SeaweedFS as an external storage service. It uses AWS SDK v3 for
 * compatibility with the S3 API.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  ListBucketsCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
  type _Object,
  type Bucket,
  type Part
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { loadS3Config, type S3Config } from '../config/s3Config';
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
  AccessDeniedError,
  InvalidRequestError,
  S3Error
} from '../types';

/**
 * S3 Service implementation using AWS SDK v3
 */
export class S3Service implements IS3Service {
  private client: S3Client;
  private config: S3Config;

  constructor(config?: S3Config) {
    this.config = config || loadS3Config();

    // Initialize S3 client with SeaweedFS configuration
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey
      },
      forcePathStyle: this.config.forcePathStyle, // Required for S3-compatible services
      // Disable AWS-specific features that SeaweedFS doesn't support
      disableHostPrefix: true,
    });

    console.log(`S3 Service initialized with endpoint: ${this.config.endpoint}`);
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
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: metadata?.contentType,
        ContentEncoding: metadata?.contentEncoding,
        ContentDisposition: metadata?.contentDisposition,
        CacheControl: metadata?.cacheControl,
        Metadata: metadata?.metadata
      });

      const response = await this.client.send(command);

      return {
        etag: response.ETag,
        versionId: response.VersionId,
        bucket,
        key,
        location: this.getPublicUrl(bucket, key)
      };
    } catch (error) {
      throw this.handleError(error, 'putObject');
    }
  }

  async getObject(bucket: string, key: string): Promise<GetObjectResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const response = await this.client.send(command);

      // Convert the response body to a buffer or readable stream
      const body = response.Body as Readable;

      return {
        body,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata
      };
    } catch (error) {
      throw this.handleError(error, 'getObject');
    }
  }

  async headObject(bucket: string, key: string): Promise<HeadObjectResult> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      });

      const response = await this.client.send(command);

      return {
        exists: true,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }
      throw this.handleError(error, 'headObject');
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      });

      await this.client.send(command);
    } catch (error) {
      throw this.handleError(error, 'deleteObject');
    }
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map(key => ({ Key: key }))
        }
      });

      const response = await this.client.send(command);

      return {
        deleted: response.Deleted?.map(obj => obj.Key!).filter(Boolean) || [],
        errors: response.Errors?.map(err => err.Key!) || []
      };
    } catch (error) {
      throw this.handleError(error, 'deleteObjects');
    }
  }

  async listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: options?.prefix,
        Delimiter: options?.delimiter,
        MaxKeys: options?.maxKeys,
        ContinuationToken: options?.continuationToken,
        StartAfter: options?.startAfter
      });

      const response = await this.client.send(command);

      const objects: S3Object[] = (response.Contents || []).map((obj: _Object) => ({
        key: obj.Key!,
        lastModified: obj.LastModified,
        etag: obj.ETag,
        size: obj.Size,
        storageClass: obj.StorageClass
      }));

      return {
        objects,
        commonPrefixes: response.CommonPrefixes?.map(prefix => prefix.Prefix!).filter(Boolean),
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
        keyCount: response.KeyCount || 0
      };
    } catch (error) {
      throw this.handleError(error, 'listObjects');
    }
  }

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  async createBucket(bucket: string): Promise<void> {
    try {
      const command = new CreateBucketCommand({
        Bucket: bucket
      });

      await this.client.send(command);
      console.log(`Bucket created: ${bucket}`);
    } catch (error: any) {
      // Ignore error if bucket already exists
      if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
        console.log(`Bucket already exists: ${bucket}`);
        return;
      }
      throw this.handleError(error, 'createBucket');
    }
  }

  async listBuckets(): Promise<ListBucketsResult> {
    try {
      const command = new ListBucketsCommand({});
      const response = await this.client.send(command);

      const buckets: S3Bucket[] = (response.Buckets || []).map((bucket: Bucket) => ({
        name: bucket.Name!,
        creationDate: bucket.CreationDate
      }));

      return { buckets };
    } catch (error) {
      throw this.handleError(error, 'listBuckets');
    }
  }

  async deleteBucket(bucket: string): Promise<void> {
    try {
      // Check if bucket is empty first
      const objects = await this.listObjects(bucket, { maxKeys: 1 });
      if (objects.objects.length > 0) {
        throw new InvalidRequestError('Bucket is not empty');
      }

      const command = new DeleteBucketCommand({
        Bucket: bucket
      });

      await this.client.send(command);
      console.log(`Bucket deleted: ${bucket}`);
    } catch (error) {
      throw this.handleError(error, 'deleteBucket');
    }
  }

  async bucketExists(bucket: string): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({
        Bucket: bucket
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw this.handleError(error, 'bucketExists');
    }
  }

  // ============================================================================
  // Multipart Upload Operations
  // ============================================================================

  async createMultipartUpload(
    bucket: string,
    key: string,
    metadata?: ObjectMetadata
  ): Promise<CreateMultipartResult> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: metadata?.contentType,
        ContentEncoding: metadata?.contentEncoding,
        Metadata: metadata?.metadata
      });

      const response = await this.client.send(command);

      return {
        uploadId: response.UploadId!,
        bucket,
        key
      };
    } catch (error) {
      throw this.handleError(error, 'createMultipartUpload');
    }
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | Readable
  ): Promise<UploadPartResult> {
    try {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: data
      });

      const response = await this.client.send(command);

      return {
        etag: response.ETag!,
        partNumber
      };
    } catch (error) {
      throw this.handleError(error, 'uploadPart');
    }
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ): Promise<CompleteMultipartResult> {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map(part => ({
            ETag: part.etag,
            PartNumber: part.partNumber
          }))
        }
      });

      const response = await this.client.send(command);

      return {
        location: response.Location || this.getPublicUrl(bucket, key),
        bucket: response.Bucket || bucket,
        key: response.Key || key,
        etag: response.ETag!,
        versionId: response.VersionId
      };
    } catch (error) {
      throw this.handleError(error, 'completeMultipartUpload');
    }
  }

  async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId
      });

      await this.client.send(command);
    } catch (error) {
      throw this.handleError(error, 'abortMultipartUpload');
    }
  }

  async listParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<{ parts: UploadPartResult[]; uploadId: string }> {
    try {
      const command = new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId
      });

      const response = await this.client.send(command);

      const parts: UploadPartResult[] = (response.Parts || []).map((part: Part) => ({
        etag: part.ETag!,
        partNumber: part.PartNumber!
      }));

      return {
        parts,
        uploadId: response.UploadId!
      };
    } catch (error) {
      throw this.handleError(error, 'listParts');
    }
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
    try {
      const command = operation === 'getObject'
        ? new GetObjectCommand({ Bucket: bucket, Key: key })
        : new PutObjectCommand({ Bucket: bucket, Key: key });

      const url = await getSignedUrl(this.client, command, { expiresIn });
      return url;
    } catch (error) {
      throw this.handleError(error, 'generatePresignedUrl');
    }
  }

  getPublicUrl(bucket: string, key: string): string {
    // Construct the public URL based on the endpoint
    const endpoint = this.config.endpoint.replace(/\/$/, '');
    return `${endpoint}/${bucket}/${key}`;
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string
  ): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: destBucket,
        Key: destKey,
        CopySource: `${sourceBucket}/${sourceKey}`
      });

      await this.client.send(command);
    } catch (error) {
      throw this.handleError(error, 'copyObject');
    }
  }

  // ============================================================================
  // Advanced Operations
  // ============================================================================

  /**
   * Upload a large file using managed upload with automatic multipart handling
   */
  async uploadLargeFile(
    bucket: string,
    key: string,
    data: Buffer | Readable,
    metadata?: ObjectMetadata,
    onProgress?: (progress: number) => void
  ): Promise<PutObjectResult> {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: metadata?.contentType,
          Metadata: metadata?.metadata
        },
        queueSize: 4, // Concurrent uploads
        partSize: this.config.multipartThreshold,
        leavePartsOnError: false
      });

      // Track upload progress if callback provided
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          if (progress.total) {
            const percentage = Math.round((progress.loaded! / progress.total) * 100);
            onProgress(percentage);
          }
        });
      }

      const result = await upload.done();

      return {
        etag: result.ETag,
        versionId: result.VersionId,
        bucket,
        key,
        location: this.getPublicUrl(bucket, key)
      };
    } catch (error) {
      throw this.handleError(error, 'uploadLargeFile');
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: any, operation: string): Error {
    console.error(`S3 operation failed: ${operation}`, error);

    // Handle specific S3 errors
    if (error.name === 'NoSuchBucket') {
      return new BucketNotFoundError(error.Bucket || 'unknown');
    }
    if (error.name === 'NoSuchKey') {
      return new ObjectNotFoundError(error.Bucket || 'unknown', error.Key || 'unknown');
    }
    if (error.name === 'AccessDenied') {
      return new AccessDeniedError(error.message);
    }
    if (error.name === 'InvalidRequest') {
      return new InvalidRequestError(error.message);
    }

    // Handle AWS SDK errors
    if (error.$metadata) {
      return new S3Error(
        error.message || `S3 operation failed: ${operation}`,
        error.name || 'UnknownError',
        error.$metadata.httpStatusCode
      );
    }

    // Return original error if not an S3 error
    return error;
  }
}

import { LocalStorageService } from './localStorageService';
import type { IS3Service } from '../types';

// Singleton instance
let s3Service: IS3Service | null = null;
let isUsingLocalStorage = false;

/**
 * Get or create the S3 service instance with automatic fallback to local storage
 */
export function getS3Service(): IS3Service {
  if (!s3Service) {
    // Check if explicitly forced to use local storage
    const forceLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';

    if (forceLocalStorage) {
      console.log('USE_LOCAL_STORAGE=true, forcing local storage');
      s3Service = new LocalStorageService();
      isUsingLocalStorage = true;
    } else {
      // Always try S3Service first (even in development)
      console.log('Initializing S3Service...');
      s3Service = new S3Service();
      isUsingLocalStorage = false;
    }
  }
  return s3Service;
}

/**
 * Check if currently using local storage
 */
export function isLocalStorage(): boolean {
  return isUsingLocalStorage;
}