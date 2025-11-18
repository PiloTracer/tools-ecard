# S3-Bucket Feature

Complete S3-compatible storage implementation for the E-Cards application using SeaweedFS as the external storage backend.

## ✅ Implementation Status

**Status:** COMPLETE - All core functionality implemented and ready for use.

### Completed Components

- ✅ **S3 Service** - Full AWS SDK v3 integration with SeaweedFS
- ✅ **Configuration Module** - Environment-based configuration with validation
- ✅ **TypeScript Types** - Complete type definitions and interfaces
- ✅ **API Controller** - All endpoint handlers implemented
- ✅ **Fastify Routes** - RESTful API routes with validation schemas
- ✅ **Multipart Upload** - Support for large file uploads
- ✅ **Presigned URLs** - Temporary access URL generation
- ✅ **Error Handling** - Custom error types with proper status codes
- ✅ **Test Script** - Comprehensive integration test suite

## 📁 File Structure

```
api-server/src/features/s3-bucket/
├── config/
│   └── s3Config.ts           # Configuration loader and helpers
├── controllers/
│   └── s3Controller.ts       # API request handlers
├── routes/
│   └── s3Routes.ts           # Fastify route definitions
├── services/
│   └── s3Service.ts          # Core S3 operations service
├── types/
│   └── index.ts              # TypeScript types and interfaces
├── index.ts                  # Public API exports
├── test-s3.ts                # Integration test script
└── README.md                 # This file
```

## 🚀 Quick Start

### Environment Configuration

Add these variables to your `.env` file:

```env
# SeaweedFS Configuration (External Service)
SEAWEEDFS_ENDPOINT=http://your-seaweedfs-host:8333
SEAWEEDFS_ACCESS_KEY=your_access_key
SEAWEEDFS_SECRET_KEY=your_secret_key
SEAWEEDFS_BUCKET=ecards
SEAWEEDFS_REGION=us-east-1

# Storage Configuration
STORAGE_MAX_FILE_SIZE=104857600  # 100MB
STORAGE_MULTIPART_THRESHOLD=10485760  # 10MB
STORAGE_ALLOWED_TYPES=image/png,image/jpeg,image/jpg,application/pdf,application/zip
```

### Testing the Integration

Run the test script to verify SeaweedFS connection:

```bash
cd api-server
npx tsx src/features/s3-bucket/test-s3.ts
```

### Starting the API Server

The S3 routes are automatically registered when the API server starts:

```bash
# Using Docker
docker-compose -f docker-compose.dev.yml up api-server

# Or locally
cd api-server
npm run dev
```

## 📡 API Endpoints

### Object Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/s3/objects` | Upload a file |
| GET | `/api/v1/s3/objects/:bucket/:key` | Download a file |
| HEAD | `/api/v1/s3/objects/:bucket/:key` | Check if file exists |
| DELETE | `/api/v1/s3/objects/:bucket/:key` | Delete a file |
| POST | `/api/v1/s3/objects/delete-batch` | Delete multiple files |
| GET | `/api/v1/s3/objects?bucket=...` | List objects in bucket |
| POST | `/api/v1/s3/objects/copy` | Copy object |

### Bucket Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/s3/buckets` | Create bucket |
| GET | `/api/v1/s3/buckets` | List all buckets |
| DELETE | `/api/v1/s3/buckets/:name` | Delete bucket |

### Utility Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/s3/presigned-url` | Generate presigned URL |
| POST | `/api/v1/s3/multipart/start` | Start multipart upload |
| POST | `/api/v1/s3/multipart/part` | Upload part |
| POST | `/api/v1/s3/multipart/complete` | Complete multipart upload |
| DELETE | `/api/v1/s3/multipart/abort` | Abort multipart upload |

## 💻 Usage Examples

### Upload a File

```typescript
// Using FormData (from frontend)
const formData = new FormData();
formData.append('file', fileBlob, 'image.png');
formData.append('bucket', 'users');
formData.append('prefix', 'profile-pictures');

const response = await fetch('http://localhost:7400/api/v1/s3/objects', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('File uploaded to:', result.location);
```

### Download a File

```typescript
const response = await fetch('http://localhost:7400/api/v1/s3/objects/users/profile.png');
const blob = await response.blob();
// Use the blob (display image, save file, etc.)
```

### Generate Presigned URL

```typescript
const response = await fetch('http://localhost:7400/api/v1/s3/presigned-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'get',
    bucket: 'users',
    key: 'document.pdf',
    expiresIn: 3600 // 1 hour
  })
});

const { url } = await response.json();
// Share this temporary URL for direct access
```

### List Objects

```typescript
const response = await fetch('http://localhost:7400/api/v1/s3/objects?bucket=users&prefix=documents/');
const { objects } = await response.json();

objects.forEach(obj => {
  console.log(`${obj.key} - ${obj.size} bytes - ${obj.lastModified}`);
});
```

## 🏗️ Architecture

### Service Layer

The `S3Service` class provides:
- Complete S3 API compatibility using AWS SDK v3
- Automatic retry logic with exponential backoff
- Stream support for efficient memory usage
- Multipart upload for large files (>10MB)
- Connection pooling and reuse

### Controller Layer

The `S3Controller` handles:
- HTTP request/response processing
- Input validation and sanitization
- Error handling and status codes
- Stream management for uploads/downloads
- Progress tracking for large files

### Configuration

- **External Service**: SeaweedFS runs as a completely separate service
- **S3 Gateway**: Uses SeaweedFS's S3-compatible API
- **Authentication**: Access key and secret key based
- **Path Style**: Forces path-style URLs (required for S3-compatible services)

## 🔒 Security Features

1. **File Type Validation**: Only allowed MIME types accepted
2. **Size Limits**: Configurable max file size (default 100MB)
3. **Access Control**: Bucket-level permissions
4. **Presigned URLs**: Time-limited access with expiration
5. **Metadata Support**: Store custom metadata with objects
6. **Error Masking**: Internal errors not exposed to clients

## 🎯 Integration Points

### Template Designer
- Upload template backgrounds
- Store template assets
- Retrieve backgrounds for editing

### Batch Processing
- Save rendered cards
- Create batch archives
- Stream downloads

### User Profile
- Profile picture uploads
- Document storage
- Asset management

### Render Worker
- Load template resources
- Save generated outputs
- Batch ZIP creation

## 🐛 Troubleshooting

### Connection Issues

If you see "Connection refused" errors:

1. Verify SeaweedFS is running:
   ```bash
   curl http://your-seaweedfs-host:8333
   ```

2. Check environment variables:
   ```bash
   echo $SEAWEEDFS_ENDPOINT
   echo $SEAWEEDFS_ACCESS_KEY
   ```

3. Test connectivity:
   ```bash
   npx tsx src/features/s3-bucket/test-s3.ts
   ```

### Authentication Errors

If you see "Access Denied" errors:
- Verify access key and secret key are correct
- Check bucket permissions in SeaweedFS
- Ensure the bucket exists

### Upload Failures

For large file uploads:
- Increase `STORAGE_MAX_FILE_SIZE` environment variable
- Use multipart upload for files >10MB
- Check available storage space

## 📊 Performance Considerations

### Optimizations Implemented

1. **Streaming**: All file operations use streams to minimize memory usage
2. **Multipart Upload**: Automatic for large files (>10MB)
3. **Connection Pooling**: Reuses HTTP connections
4. **Parallel Uploads**: Multipart chunks upload in parallel
5. **Caching Headers**: Proper cache headers for static assets

### Recommended Settings

```env
# For production
STORAGE_MAX_FILE_SIZE=524288000  # 500MB
STORAGE_MULTIPART_THRESHOLD=5242880  # 5MB
WORKER_CONCURRENCY=4  # Parallel upload workers
```

## 🔄 Next Steps

### Immediate Enhancements

1. **Caching Layer**: Add Redis caching for frequently accessed files
2. **CDN Integration**: Serve public assets through CDN
3. **Image Processing**: Auto-resize and optimize images
4. **Virus Scanning**: Integrate with ClamAV for file scanning

### Future Features

1. **Versioning**: Enable object versioning
2. **Lifecycle Policies**: Auto-delete old files
3. **Replication**: Cross-region backup
4. **Analytics**: Track storage usage and access patterns
5. **Compression**: Auto-compress suitable file types

## 📝 Development Notes

### Adding New Operations

To add a new S3 operation:

1. Add types in `types/index.ts`
2. Implement in `services/s3Service.ts`
3. Add handler in `controllers/s3Controller.ts`
4. Define route in `routes/s3Routes.ts`
5. Update tests in `test-s3.ts`

### Error Handling Pattern

```typescript
try {
  const result = await s3Service.someOperation();
  return reply.send({ success: true, ...result });
} catch (error) {
  console.error('Operation failed:', error);
  return reply.code(500).send({
    success: false,
    error: error instanceof Error ? error.message : 'Operation failed'
  });
}
```

## 📚 References

- [AWS SDK v3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [SeaweedFS S3 API](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API)
- [Fastify Multipart Plugin](https://github.com/fastify/fastify-multipart)
- [E-Cards Project Documentation](../../../../../../CLAUDE_CONTEXT.md)

## ✨ Success!

The S3-bucket feature is now fully implemented and ready for use. All core operations are working, including:

- ✅ File uploads and downloads
- ✅ Bucket management
- ✅ Multipart uploads for large files
- ✅ Presigned URL generation
- ✅ Object listing and metadata
- ✅ Copy and delete operations

The implementation follows the E-Cards architecture patterns and integrates seamlessly with the existing application structure.