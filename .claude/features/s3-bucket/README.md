# S3-Bucket Storage Feature

Complete S3-compatible storage implementation for file management with automatic fallback to local storage.

## Overview

Provides a unified storage interface for the E-Cards application supporting both SeaweedFS (S3-compatible) and local file storage. Handles uploads, downloads, multipart operations, and presigned URLs for secure temporary access.

## User Stories

- As a user, I want to upload template backgrounds and assets so they are stored reliably
- As a developer, I want to use S3-compatible storage that works in development without external dependencies
- As an admin, I want to manage storage buckets and control file access
- As a system, I need to handle large file uploads efficiently using multipart upload
- As a user, I want to generate temporary share links for files

## Key Workflows

### 1. File Upload
1. User selects file from file picker
2. Frontend uploads via multipart form data
3. Backend validates file type and size
4. File stored in SeaweedFS or local storage
5. File location URL returned to frontend

### 2. File Download
1. User requests file by bucket/key
2. Backend retrieves file from storage
3. File streamed to client with proper headers
4. Browser handles display/download

### 3. Presigned URL Generation
1. Client requests temporary access URL
2. Backend generates time-limited signed URL
3. Client can share URL for direct access
4. URL expires after configured time

### 4. Multipart Upload (Large Files)
1. Client initiates multipart upload
2. File split into chunks (5-10MB each)
3. Each chunk uploaded in parallel
4. Backend assembles chunks on completion
5. Final file stored and location returned

## Dependencies

- **Used by:** template-textile, batch-upload, font-management
- **External services:** SeaweedFS (optional, falls back to local storage)

## Security Considerations

- File type validation (whitelist only)
- Size limits enforced (default 100MB)
- Bucket-level access control
- Presigned URLs with expiration
- Path traversal prevention
- Metadata sanitization

## Performance Targets

- Upload throughput: 10MB/s minimum
- Multipart threshold: 10MB
- Presigned URL generation: <100ms
- File listing: <500ms for 1000 objects

## Testing Strategy

### Unit Tests
- File validation logic
- Path sanitization
- URL generation

### Integration Tests
- Upload/download flows
- Multipart upload
- Bucket operations
- Storage fallback mechanism

## Known Limitations

- Local storage mode doesn't support advanced features (versioning, replication)
- No automatic file cleanup/lifecycle policies
- Single-region only (no cross-region replication)

## Configuration

See the **monorepo root** `.env` for storage configuration:
- `USE_LOCAL_STORAGE` - Force local storage mode
- `SEAWEEDFS_ENDPOINT` - S3 endpoint URL
- `SEAWEEDFS_ACCESS_KEY` - Access key
- `SEAWEEDFS_SECRET_KEY` - Secret key
- `STORAGE_MAX_FILE_SIZE` - Max file size in bytes
