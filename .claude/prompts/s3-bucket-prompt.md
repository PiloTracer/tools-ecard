# S3-Bucket Feature - Agent Quick Start Guide

## Quick Context

The s3-bucket feature provides S3-compatible storage integration for the E-Cards application using SeaweedFS. It handles all file operations including uploads, downloads, and bucket management through a unified service layer.

## Key Concepts

### Architecture Overview
```
Frontend → API Server → S3 Service → SeaweedFS
                ↓
          PostgreSQL (metadata)
```

### Storage Organization
- **Buckets**: Logical containers for files
- **Keys**: File paths within buckets (e.g., `templates/123/background.png`)
- **Metadata**: File properties stored in PostgreSQL
- **Presigned URLs**: Temporary access tokens for private files

## Common Operations

### Upload a File
```typescript
// In api-server
import { s3Service } from '@/features/s3-bucket/services/s3Service';

const result = await s3Service.putObject(
  'templates',                    // bucket
  `${templateId}/background.png`, // key
  fileBuffer,                      // data
  { contentType: 'image/png' }    // metadata
);
```

### Download a File
```typescript
const { data, metadata } = await s3Service.getObject(
  'batches',
  `${batchId}/cards/${cardId}.png`
);
// data is a stream or buffer
```

### Generate Presigned URL
```typescript
const url = await s3Service.generatePresignedUrl(
  'users',
  `${userId}/profile.jpg`,
  3600 // expires in 1 hour
);
```

### List Files in Bucket
```typescript
const { objects } = await s3Service.listObjects('templates', {
  prefix: `${templateId}/`,
  maxKeys: 100
});
```

## Integration Patterns

### With Template Designer
```typescript
// Upload template background
async function uploadBackground(templateId: string, file: Express.Multer.File) {
  const key = `${templateId}/background.${file.mimetype.split('/')[1]}`;

  const result = await s3Service.putObject(
    'templates',
    key,
    file.buffer,
    {
      contentType: file.mimetype,
      metadata: { templateId, uploadedAt: new Date().toISOString() }
    }
  );

  // Update template record with URL
  await templateRepository.update(templateId, {
    backgroundUrl: result.publicUrl
  });
}
```

### With Render Worker
```typescript
// Save rendered card
async function saveRenderedCard(batchId: string, cardId: string, imageBuffer: Buffer) {
  const key = `${batchId}/cards/${cardId}.png`;

  await s3Service.putObject(
    'batches',
    key,
    imageBuffer,
    {
      contentType: 'image/png',
      metadata: { batchId, cardId, renderedAt: new Date().toISOString() }
    }
  );

  // Update job status
  await jobRepository.markCompleted(cardId);
}
```

### With Batch Download
```typescript
// Stream ZIP file to client
async function downloadBatch(batchId: string, res: Response) {
  const { data } = await s3Service.getObject(
    'batches',
    `${batchId}/archive.zip`
  );

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}.zip"`);

  data.pipe(res);
}
```

## File Structure

```
api-server/src/features/s3-bucket/
├── controllers/
│   └── storageController.ts    # REST endpoints
├── services/
│   └── s3Service.ts            # S3 client wrapper
├── repositories/
│   └── fileMetadataRepo.ts     # Database operations
├── validators/
│   └── uploadValidator.ts      # File validation
├── middleware/
│   └── uploadMiddleware.ts     # Multer configuration
├── types.ts                     # TypeScript interfaces
└── routes.ts                    # Express routes
```

## Environment Configuration

```bash
# Required in .env
SEAWEEDFS_S3_ENDPOINT=http://seaweedfs:8333
SEAWEEDFS_ACCESS_KEY=seaweedadmin
SEAWEEDFS_SECRET_KEY=^seaweedadmin!changeme!
SEAWEEDFS_REGION=us-east-1

# Optional
STORAGE_MAX_FILE_SIZE=104857600  # 100MB
STORAGE_ALLOWED_TYPES=image/png,image/jpeg
```

## Common Issues & Solutions

### Issue: "Access Denied" errors
```typescript
// Check bucket exists and has correct permissions
await s3Service.createBucket('my-bucket');
```

### Issue: Large file uploads failing
```typescript
// Use multipart upload for files > 10MB
if (fileSize > 10 * 1024 * 1024) {
  const upload = await s3Service.createMultipartUpload(bucket, key);
  // Upload in chunks...
}
```

### Issue: Slow downloads
```typescript
// Use presigned URLs for client-side downloads
const url = await s3Service.generatePresignedUrl(bucket, key);
// Return URL to client for direct download
```

## Testing the Feature

### Manual Testing
```bash
# Upload test file
curl -X POST http://localhost:7400/api/storage/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test.png" \
  -F "bucket=templates" \
  -F "key=test/image.png"

# Download file
curl http://localhost:7400/api/storage/templates/test/image.png

# List files
curl http://localhost:7400/api/storage/templates?prefix=test/
```

### Unit Test Example
```typescript
describe('S3Service', () => {
  it('should upload file to SeaweedFS', async () => {
    const result = await s3Service.putObject(
      'test-bucket',
      'test-file.txt',
      Buffer.from('test content')
    );

    expect(result.etag).toBeDefined();
    expect(result.publicUrl).toContain('test-file.txt');
  });
});
```

## Best Practices

1. **Always validate files before upload** (type, size, content)
2. **Use streaming for large files** to avoid memory issues
3. **Store metadata in database** for fast queries
4. **Generate presigned URLs** for temporary access
5. **Implement retry logic** for network failures
6. **Monitor storage usage** per user/feature
7. **Use appropriate bucket structure** for organization
8. **Clean up failed multipart uploads** periodically

## Quick Commands

```bash
# Initialize default buckets
npm run storage:init

# Check storage health
npm run storage:health

# Clean up orphaned files
npm run storage:cleanup

# Generate storage report
npm run storage:report
```

## Related Features

- **template-designer**: Uploads backgrounds and assets
- **batch-management**: Downloads rendered cards
- **render-worker**: Saves generated images
- **user-profile**: Manages profile pictures

## Need Help?

1. Check the full specification: `.claude/features/s3-bucket.md`
2. Review implementation plan: `.claude/plans/s3-bucket-plan.md`
3. Look at reference code: `init_seaweedfs.py` and `seaweedfs_service.py`
4. Check SeaweedFS docs: https://github.com/seaweedfs/seaweedfs/wiki/s3-api