/**
 * S3 Configuration for SeaweedFS Integration
 *
 * This module handles the configuration for connecting to SeaweedFS
 * using the S3-compatible API. SeaweedFS is treated as an external/remote
 * service, not part of the Docker network.
 */

import { z } from 'zod';

// Configuration schema
const s3ConfigSchema = z.object({
  endpoint: z.string().url().default('http://localhost:8333'),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  region: z.string().default('us-east-1'),
  bucket: z.string().optional(),
  forcePathStyle: z.boolean().default(true), // Required for S3-compatible services
  signatureVersion: z.literal('v4').default('v4'),
  maxFileSize: z.number().positive().default(104857600), // 100MB
  multipartThreshold: z.number().positive().default(10485760), // 10MB
  allowedMimeTypes: z.array(z.string()).default([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/zip'
  ])
});

export type S3Config = z.infer<typeof s3ConfigSchema>;

/**
 * Load S3 configuration from environment variables
 */
export function loadS3Config(): S3Config {
  const config = s3ConfigSchema.parse({
    endpoint: process.env.SEAWEEDFS_ENDPOINT,
    accessKey: process.env.SEAWEEDFS_ACCESS_KEY || 'your_seaweedfs_access_key',
    secretKey: process.env.SEAWEEDFS_SECRET_KEY || 'your_seaweedfs_secret_key',
    region: process.env.SEAWEEDFS_REGION || 'us-east-1',
    bucket: process.env.SEAWEEDFS_BUCKET || 'templates',
    forcePathStyle: true,
    signatureVersion: 'v4',
    maxFileSize: Number(process.env.STORAGE_MAX_FILE_SIZE) || 104857600,
    multipartThreshold: Number(process.env.STORAGE_MULTIPART_THRESHOLD) || 10485760,
    allowedMimeTypes: process.env.STORAGE_ALLOWED_TYPES?.split(',') || [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/zip'
    ]
  });

  // Log configuration (without sensitive data)
  console.log('S3 Configuration loaded:', {
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    maxFileSize: `${config.maxFileSize / 1024 / 1024}MB`,
    multipartThreshold: `${config.multipartThreshold / 1024 / 1024}MB`,
    allowedMimeTypes: config.allowedMimeTypes
  });

  return config;
}

/**
 * Default bucket names for the application
 */
export const DEFAULT_BUCKETS = {
  TEMPLATES: 'templates',
  USERS: 'users',
  BATCHES: 'batches',
  APPLICATION: 'application'
} as const;

/**
 * Get the full object key with proper prefixes
 */
export function getObjectKey(bucket: string, ...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

/**
 * Parse an S3 URL to extract bucket and key
 */
export function parseS3Url(url: string): { bucket: string; key: string } | null {
  // Handle s3:// URLs
  const s3Match = url.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (s3Match) {
    return { bucket: s3Match[1], key: s3Match[2] };
  }

  // Handle HTTP(S) URLs with known patterns
  const httpMatch = url.match(/\/storage\/([^\/]+)\/(.+)$/);
  if (httpMatch) {
    return { bucket: httpMatch[1], key: httpMatch[2] };
  }

  return null;
}