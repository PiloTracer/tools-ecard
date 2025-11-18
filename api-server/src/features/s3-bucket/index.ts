/**
 * S3-Bucket Feature Public API
 *
 * This module exports all public components of the s3-bucket feature.
 */

// Export service
export { S3Service, getS3Service } from './services/s3Service';

// Export configuration
export { loadS3Config, DEFAULT_BUCKETS, getObjectKey, parseS3Url } from './config/s3Config';

// Export routes
export { s3Routes } from './routes/s3Routes';

// Export types
export * from './types';

// Export controller (for testing or direct usage)
export { s3Controller } from './controllers/s3Controller';

/**
 * Feature initialization function
 * This can be called to ensure S3 buckets are created on startup
 */
export async function initializeS3Feature(): Promise<void> {
  try {
    const { getS3Service } = await import('./services/s3Service');
    const { DEFAULT_BUCKETS } = await import('./config/s3Config');

    const s3Service = getS3Service();

    console.log('Initializing S3 buckets...');

    // Create default buckets if they don't exist
    for (const bucket of Object.values(DEFAULT_BUCKETS)) {
      try {
        await s3Service.createBucket(bucket);
        console.log(`✓ Bucket ready: ${bucket}`);
      } catch (error) {
        console.error(`✗ Failed to create bucket ${bucket}:`, error);
      }
    }

    console.log('S3 feature initialization complete');
  } catch (error) {
    console.error('Failed to initialize S3 feature:', error);
    // Don't throw - allow app to start even if S3 is not available
  }
}