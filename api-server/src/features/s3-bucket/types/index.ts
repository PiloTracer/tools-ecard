/**
 * TypeScript Types and Interfaces for S3 Bucket Feature
 */

import { Readable } from 'stream';

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Object metadata for S3 operations
 */
export interface ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  contentEncoding?: string;
  contentDisposition?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

/**
 * Result from putting an object to S3
 */
export interface PutObjectResult {
  etag?: string;
  versionId?: string;
  bucket: string;
  key: string;
  location: string;
}

/**
 * Result from getting an object from S3
 */
export interface GetObjectResult {
  body: Readable | Buffer;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * Result from head object operation
 */
export interface HeadObjectResult {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

/**
 * Options for listing objects
 */
export interface ListObjectsOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
  startAfter?: string;
}

/**
 * Result from listing objects
 */
export interface ListObjectsResult {
  objects: S3Object[];
  commonPrefixes?: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
  keyCount: number;
}

/**
 * S3 Object information
 */
export interface S3Object {
  key: string;
  lastModified?: Date;
  etag?: string;
  size?: number;
  storageClass?: string;
}

/**
 * Result from listing buckets
 */
export interface ListBucketsResult {
  buckets: S3Bucket[];
}

/**
 * S3 Bucket information
 */
export interface S3Bucket {
  name: string;
  creationDate?: Date;
}

// ============================================================================
// Multipart Upload Types
// ============================================================================

/**
 * Result from creating multipart upload
 */
export interface CreateMultipartResult {
  uploadId: string;
  bucket: string;
  key: string;
}

/**
 * Result from uploading a part
 */
export interface UploadPartResult {
  etag: string;
  partNumber: number;
}

/**
 * Completed part information
 */
export interface CompletedPart {
  etag: string;
  partNumber: number;
}

/**
 * Result from completing multipart upload
 */
export interface CompleteMultipartResult {
  location: string;
  bucket: string;
  key: string;
  etag: string;
  versionId?: string;
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Main S3 Service Interface
 */
export interface IS3Service {
  // Object operations
  putObject(
    bucket: string,
    key: string,
    data: Buffer | Readable | string,
    metadata?: ObjectMetadata
  ): Promise<PutObjectResult>;

  getObject(bucket: string, key: string): Promise<GetObjectResult>;

  headObject(bucket: string, key: string): Promise<HeadObjectResult>;

  deleteObject(bucket: string, key: string): Promise<void>;

  deleteObjects(bucket: string, keys: string[]): Promise<{ deleted: string[]; errors: string[] }>;

  listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult>;

  // Bucket operations
  createBucket(bucket: string): Promise<void>;

  listBuckets(): Promise<ListBucketsResult>;

  deleteBucket(bucket: string): Promise<void>;

  bucketExists(bucket: string): Promise<boolean>;

  // Multipart operations
  createMultipartUpload(
    bucket: string,
    key: string,
    metadata?: ObjectMetadata
  ): Promise<CreateMultipartResult>;

  uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    data: Buffer | Readable
  ): Promise<UploadPartResult>;

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ): Promise<CompleteMultipartResult>;

  abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;

  listParts(
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<{ parts: UploadPartResult[]; uploadId: string }>;

  // Utility operations
  generatePresignedUrl(
    operation: 'getObject' | 'putObject',
    bucket: string,
    key: string,
    expiresIn?: number
  ): Promise<string>;

  getPublicUrl(bucket: string, key: string): string;

  copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string
  ): Promise<void>;
}

// ============================================================================
// Error Types
// ============================================================================

export class S3Error extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'S3Error';
  }
}

export class BucketNotFoundError extends S3Error {
  constructor(bucket: string) {
    super(`Bucket not found: ${bucket}`, 'NoSuchBucket', 404);
  }
}

export class ObjectNotFoundError extends S3Error {
  constructor(bucket: string, key: string) {
    super(`Object not found: ${bucket}/${key}`, 'NoSuchKey', 404);
  }
}

export class AccessDeniedError extends S3Error {
  constructor(message: string = 'Access denied') {
    super(message, 'AccessDenied', 403);
  }
}

export class InvalidRequestError extends S3Error {
  constructor(message: string) {
    super(message, 'InvalidRequest', 400);
  }
}

export class QuotaExceededError extends S3Error {
  constructor(message: string = 'Storage quota exceeded') {
    super(message, 'QuotaExceeded', 507);
  }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Upload file request
 */
export interface UploadFileRequest {
  file: {
    data: Buffer;
    filename: string;
    mimetype: string;
    size: number;
  };
  bucket?: string;
  prefix?: string;
  metadata?: Record<string, string>;
}

/**
 * Upload file response
 */
export interface UploadFileResponse {
  success: boolean;
  location: string;
  bucket: string;
  key: string;
  size: number;
  contentType: string;
}

/**
 * Generate presigned URL request
 */
export interface PresignedUrlRequest {
  operation: 'get' | 'put';
  bucket: string;
  key: string;
  expiresIn?: number;
  contentType?: string;
}

/**
 * Generate presigned URL response
 */
export interface PresignedUrlResponse {
  url: string;
  expiresAt: Date;
}

/**
 * List objects request
 */
export interface ListObjectsRequest {
  bucket: string;
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

/**
 * Delete objects request
 */
export interface DeleteObjectsRequest {
  bucket: string;
  keys: string[];
}

/**
 * Delete objects response
 */
export interface DeleteObjectsResponse {
  deleted: string[];
  errors: Array<{ key: string; error: string }>;
}

// ============================================================================
// Constants
// ============================================================================

export const S3_CONSTANTS = {
  DEFAULT_EXPIRY: 3600, // 1 hour
  MAX_EXPIRY: 604800, // 7 days
  MIN_PART_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PART_SIZE: 5 * 1024 * 1024 * 1024, // 5GB
  MAX_PARTS: 10000,
  DEFAULT_PART_SIZE: 10 * 1024 * 1024, // 10MB
} as const;