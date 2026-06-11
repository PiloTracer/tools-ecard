/**
 * S3 storage service for render-worker
 * Uploads rendered card images to SeaweedFS (S3-compatible)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { workerConfig } from '../core/config';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const { endpoint, accessKey, secretKey } = workerConfig.seaweedfs;

    if (!endpoint) {
      throw new Error('SeaweedFS endpoint not configured. Set SEAWEEDFS_ENDPOINT env var.');
    }

    s3Client = new S3Client({
      endpoint,
      region: 'us-east-1', // SeaweedFS ignores region but SDK requires it
      credentials: {
        accessKeyId: accessKey || 'access_key',
        secretAccessKey: secretKey || 'secret_key',
      },
      forcePathStyle: true, // Required for S3-compatible storage like SeaweedFS
    });
  }

  return s3Client;
}

export interface UploadOptions {
  bucket?: string;
  key: string;
  body: Buffer;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  bucket: string;
  etag?: string;
}

/**
 * Upload a rendered card image to S3-compatible storage
 */
export async function uploadToStorage(options: UploadOptions): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = options.bucket || workerConfig.seaweedfs.bucket || 'ecards-rendered';

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: options.key,
    Body: options.body,
    ContentType: options.contentType || 'image/png',
  });

  const result = await client.send(command);

  return {
    key: options.key,
    bucket,
    etag: result.ETag,
  };
}

/**
 * Build a storage key for a rendered card
 * Format: rendered/{batchId}/{recordId}.png
 */
export function buildCardStorageKey(batchId: string, recordId: string): string {
  return `rendered/${batchId}/${recordId}.png`;
}

/**
 * Build a public URL for a stored card (presigned or direct)
 */
export function buildCardUrl(bucket: string, key: string): string {
  const { endpoint } = workerConfig.seaweedfs;
  const baseUrl = endpoint.replace(/\/+$/, '');
  return `${baseUrl}/${bucket}/${key}`;
}
