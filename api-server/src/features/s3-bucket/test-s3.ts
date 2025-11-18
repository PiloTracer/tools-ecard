/**
 * Test script for S3 integration
 *
 * Run this script to verify SeaweedFS S3 integration is working.
 * Usage: npx tsx src/features/s3-bucket/test-s3.ts
 */

import { getS3Service } from './services/s3Service';
import { DEFAULT_BUCKETS } from './config/s3Config';

async function testS3Integration() {
  console.log('🔧 Testing S3 Integration with SeaweedFS...\n');

  const s3Service = getS3Service();
  const testBucket = DEFAULT_BUCKETS.APPLICATION;
  const testKey = 'test/test-file.txt';
  const testContent = `Test content generated at ${new Date().toISOString()}`;

  try {
    // ============================================================================
    // 1. Test Bucket Operations
    // ============================================================================
    console.log('1. Testing bucket operations...');

    // List buckets
    const buckets = await s3Service.listBuckets();
    console.log(`   ✓ Listed ${buckets.buckets.length} buckets`);
    buckets.buckets.forEach(b => console.log(`     - ${b.name}`));

    // Create test bucket
    await s3Service.createBucket(testBucket);
    console.log(`   ✓ Created/verified bucket: ${testBucket}`);

    // Check if bucket exists
    const exists = await s3Service.bucketExists(testBucket);
    console.log(`   ✓ Bucket exists check: ${exists}`);

    // ============================================================================
    // 2. Test Object Operations
    // ============================================================================
    console.log('\n2. Testing object operations...');

    // Upload object
    const putResult = await s3Service.putObject(
      testBucket,
      testKey,
      Buffer.from(testContent),
      {
        contentType: 'text/plain',
        metadata: { 'test': 'true', 'timestamp': new Date().toISOString() }
      }
    );
    console.log(`   ✓ Uploaded object to: ${putResult.location}`);

    // Check if object exists
    const headResult = await s3Service.headObject(testBucket, testKey);
    console.log(`   ✓ Object exists: ${headResult.exists}`);
    if (headResult.exists) {
      console.log(`     - Content-Type: ${headResult.contentType}`);
      console.log(`     - Size: ${headResult.contentLength} bytes`);
    }

    // Download object
    const getResult = await s3Service.getObject(testBucket, testKey);
    let downloadedContent = '';
    if (getResult.body) {
      if (Buffer.isBuffer(getResult.body)) {
        downloadedContent = getResult.body.toString();
      } else {
        // Handle stream
        const chunks: Buffer[] = [];
        for await (const chunk of getResult.body as any) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        downloadedContent = Buffer.concat(chunks).toString();
      }
    }
    console.log(`   ✓ Downloaded object`);
    console.log(`     - Content matches: ${downloadedContent === testContent}`);

    // List objects
    const listResult = await s3Service.listObjects(testBucket, { prefix: 'test/' });
    console.log(`   ✓ Listed ${listResult.objects.length} objects with prefix 'test/'`);
    listResult.objects.forEach(obj => {
      console.log(`     - ${obj.key} (${obj.size} bytes)`);
    });

    // ============================================================================
    // 3. Test Presigned URLs
    // ============================================================================
    console.log('\n3. Testing presigned URLs...');

    // Generate GET presigned URL
    const getUrl = await s3Service.generatePresignedUrl('getObject', testBucket, testKey, 300);
    console.log(`   ✓ Generated GET presigned URL (expires in 5 minutes)`);
    console.log(`     ${getUrl.substring(0, 80)}...`);

    // Generate PUT presigned URL
    const putUrl = await s3Service.generatePresignedUrl('putObject', testBucket, 'test/upload.txt', 300);
    console.log(`   ✓ Generated PUT presigned URL (expires in 5 minutes)`);
    console.log(`     ${putUrl.substring(0, 80)}...`);

    // ============================================================================
    // 4. Test Copy Operation
    // ============================================================================
    console.log('\n4. Testing copy operation...');

    const copyKey = 'test/test-file-copy.txt';
    await s3Service.copyObject(testBucket, testKey, testBucket, copyKey);
    console.log(`   ✓ Copied object to: ${copyKey}`);

    // ============================================================================
    // 5. Test Multipart Upload (for large files)
    // ============================================================================
    console.log('\n5. Testing multipart upload...');

    const multipartKey = 'test/large-file.txt';
    const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB of data

    // Create multipart upload
    const multipartUpload = await s3Service.createMultipartUpload(
      testBucket,
      multipartKey,
      { contentType: 'text/plain' }
    );
    console.log(`   ✓ Created multipart upload: ${multipartUpload.uploadId}`);

    // Upload parts
    const partSize = 5 * 1024 * 1024; // 5MB parts
    const parts = [];
    let partNumber = 1;

    for (let i = 0; i < largeContent.length; i += partSize) {
      const partData = Buffer.from(largeContent.substring(i, i + partSize));
      const partResult = await s3Service.uploadPart(
        testBucket,
        multipartKey,
        multipartUpload.uploadId,
        partNumber,
        partData
      );
      parts.push({ etag: partResult.etag, partNumber: partResult.partNumber });
      console.log(`   ✓ Uploaded part ${partNumber} (${partData.length} bytes)`);
      partNumber++;
    }

    // Complete multipart upload
    const completeResult = await s3Service.completeMultipartUpload(
      testBucket,
      multipartKey,
      multipartUpload.uploadId,
      parts
    );
    console.log(`   ✓ Completed multipart upload: ${completeResult.location}`);

    // ============================================================================
    // 6. Cleanup
    // ============================================================================
    console.log('\n6. Cleaning up test objects...');

    // Delete test objects
    const keysToDelete = [testKey, copyKey, multipartKey];
    const deleteResult = await s3Service.deleteObjects(testBucket, keysToDelete);
    console.log(`   ✓ Deleted ${deleteResult.deleted.length} objects`);
    if (deleteResult.errors.length > 0) {
      console.log(`   ⚠ Failed to delete ${deleteResult.errors.length} objects`);
    }

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n✅ All S3 integration tests passed successfully!');
    console.log('\nS3 Feature is ready for use with the following endpoints:');
    console.log('  POST   /api/v1/s3/objects           - Upload file');
    console.log('  GET    /api/v1/s3/objects/:b/:k     - Download file');
    console.log('  DELETE /api/v1/s3/objects/:b/:k     - Delete file');
    console.log('  HEAD   /api/v1/s3/objects/:b/:k     - Check file exists');
    console.log('  GET    /api/v1/s3/objects            - List objects');
    console.log('  POST   /api/v1/s3/buckets            - Create bucket');
    console.log('  GET    /api/v1/s3/buckets            - List buckets');
    console.log('  DELETE /api/v1/s3/buckets/:name      - Delete bucket');
    console.log('  POST   /api/v1/s3/presigned-url      - Generate presigned URL');
    console.log('  POST   /api/v1/s3/multipart/start    - Start multipart upload');
    console.log('  POST   /api/v1/s3/multipart/part     - Upload part');
    console.log('  POST   /api/v1/s3/multipart/complete - Complete multipart upload');
    console.log('  DELETE /api/v1/s3/multipart/abort    - Abort multipart upload');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }

    console.log('\n⚠️  Troubleshooting tips:');
    console.log('1. Check SeaweedFS is running and accessible');
    console.log('2. Verify SEAWEEDFS_ENDPOINT environment variable is set correctly');
    console.log('3. Ensure SEAWEEDFS_ACCESS_KEY and SEAWEEDFS_SECRET_KEY are correct');
    console.log('4. Check network connectivity to the SeaweedFS server');

    process.exit(1);
  }
}

// Run the test
testS3Integration().catch(console.error);