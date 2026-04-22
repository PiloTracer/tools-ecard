# S3-Bucket Feature Specification

## Overview

The s3-bucket feature provides S3-compatible cloud storage integration for the E-Cards application using SeaweedFS as the storage backend. This feature handles all file storage operations including template backgrounds, user assets, rendered cards, and batch archives.

## Core Functionality

### Storage Operations
- **Upload**: Stream files directly to SeaweedFS buckets
- **Download**: Retrieve files with support for streaming and byte ranges
- **Delete**: Remove files from storage
- **Existence Check**: Verify if files exist before operations
- **Presigned URLs**: Generate temporary access URLs with expiration

### Bucket Management
- **Create Bucket**: Initialize new storage buckets
- **List Buckets**: Retrieve all available buckets
- **Delete Bucket**: Remove empty buckets (with safety checks)
- **Bucket Policies**: Set access control and lifecycle rules

### Multipart Upload Support
- **Initiate Upload**: Start large file upload session
- **Upload Parts**: Stream file chunks in parallel
- **Complete Upload**: Merge parts into final object
- **Abort Upload**: Cancel incomplete uploads

## API Surface

### TypeScript Service Interface
```typescript
interface S3BucketService {
  // Object operations
  putObject(bucket: string, key: string, data: Buffer | Stream, metadata?: ObjectMetadata): Promise<PutObjectResult>
  getObject(bucket: string, key: string): Promise<GetObjectResult>
  headObject(bucket: string, key: string): Promise<HeadObjectResult>
  deleteObject(bucket: string, key: string): Promise<void>
  listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult>

  // Bucket operations
  createBucket(bucket: string): Promise<void>
  listBuckets(): Promise<ListBucketsResult>
  deleteBucket(bucket: string): Promise<void>

  // Multipart operations
  createMultipartUpload(bucket: string, key: string): Promise<CreateMultipartResult>
  uploadPart(uploadId: string, partNumber: number, data: Buffer): Promise<UploadPartResult>
  completeMultipartUpload(uploadId: string, parts: CompletedPart[]): Promise<CompleteMultipartResult>
  abortMultipartUpload(uploadId: string): Promise<void>

  // Utility operations
  generatePresignedUrl(bucket: string, key: string, expires?: number): Promise<string>
  getPublicUrl(bucket: string, key: string): string
}
```

### REST API Endpoints
```
POST   /api/storage/upload           - Upload file
GET    /api/storage/:bucket/:key     - Download file
DELETE /api/storage/:bucket/:key     - Delete file
HEAD   /api/storage/:bucket/:key     - Check file exists
GET    /api/storage/:bucket          - List objects in bucket

POST   /api/storage/buckets          - Create bucket
GET    /api/storage/buckets          - List all buckets
DELETE /api/storage/buckets/:bucket  - Delete bucket

POST   /api/storage/multipart/init   - Start multipart upload
POST   /api/storage/multipart/upload - Upload part
POST   /api/storage/multipart/complete - Complete upload
POST   /api/storage/multipart/abort  - Abort upload
```

## Configuration Requirements

### Environment Variables
```bash
# SeaweedFS Connection
SEAWEEDFS_S3_ENDPOINT=http://seaweedfs:8333    # S3 gateway endpoint
SEAWEEDFS_FILER_URL=http://seaweedfs:8888      # Filer endpoint for direct access
SEAWEEDFS_PUBLIC_URL=/storage                   # Public URL prefix
SEAWEEDFS_ACCESS_KEY=seaweedadmin
SEAWEEDFS_SECRET_KEY=^seaweedadmin!changeme!
SEAWEEDFS_REGION=us-east-1

# Storage Configuration
STORAGE_MAX_FILE_SIZE=104857600  # 100MB default
STORAGE_ALLOWED_TYPES=image/png,image/jpeg,application/pdf
STORAGE_MULTIPART_THRESHOLD=10485760  # 10MB - use multipart for larger files
```

### Bucket Structure
```
ecards/
├── templates/
│   └── {templateId}/
│       ├── background.{ext}
│       └── assets/
├── users/
│   └── {userId}/
│       ├── profile-picture.{ext}
│       └── documents/
├── batches/
│   └── {batchId}/
│       ├── cards/
│       │   └── {recordId}.png
│       └── archive.zip
└── application/
    └── assets/
        ├── fonts/
        └── icons/
```

## Integration Points

### Frontend Integration
- **Template Designer**: Upload backgrounds and assets
- **User Profile**: Profile picture management
- **Batch Management**: Download generated cards
- **Preview Components**: Display stored images

### API Server Integration
- **Template API**: Store template backgrounds
- **Batch API**: Save rendered cards
- **User API**: Manage user documents
- **Asset API**: Handle application assets

### Render Worker Integration
- **Card Renderer**: Save generated cards
- **Archive Creator**: Store batch ZIP files
- **Asset Loader**: Retrieve templates and fonts

### External Services
- **SeaweedFS**: S3-compatible storage backend
- **CDN**: Optional content delivery network
- **Backup Service**: Periodic backup to external storage

## Security Considerations

### Access Control
- Bucket-level permissions
- User isolation via key prefixes
- Signed URLs for temporary access
- CORS configuration for browser uploads

### Data Protection
- Server-side encryption at rest
- TLS for data in transit
- Virus scanning on uploads
- File type validation

### Rate Limiting
- Upload rate limits per user
- Download bandwidth throttling
- Concurrent connection limits

## Performance Targets

### Upload Performance
- Small files (<1MB): <500ms
- Medium files (1-10MB): <2s
- Large files (10-100MB): <10s
- Multipart uploads: 10MB/s throughput

### Download Performance
- Image previews: <200ms
- Full resolution images: <500ms
- Batch archives: Stream with progress

### Availability
- 99.9% uptime SLA
- Automatic failover
- Request retry with exponential backoff

## Error Handling

### Common Errors
- `BucketNotFound`: Bucket doesn't exist
- `ObjectNotFound`: File doesn't exist
- `AccessDenied`: Insufficient permissions
- `QuotaExceeded`: Storage limit reached
- `InvalidFileType`: Unsupported file format
- `FileTooLarge`: Exceeds size limit

### Retry Strategy
- Network errors: 3 retries with backoff
- Rate limit errors: Exponential backoff
- Server errors: Circuit breaker pattern

## Monitoring & Logging

### Metrics
- Upload/download count and size
- Error rates by operation
- Storage usage per bucket
- Request latency percentiles

### Audit Logging
- All storage operations logged
- User actions tracked
- Failed attempts recorded
- Compliance audit trail