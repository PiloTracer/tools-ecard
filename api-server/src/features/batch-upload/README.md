# Batch Upload Feature

## Purpose
Handles batch file uploads for card generation, including file storage in SeaweedFS, database tracking, and async job processing.

## Components

### Controllers
- `batchController` - HTTP request handlers for batch operations

### Services
- `batchUploadService` - Core business logic for batch uploads
- `storageService` - SeaweedFS/local storage integration
- `queueService` - Redis/Bull queue for async job processing

### Repositories
- `batchRepository` - Database access layer for batch records

### Validators
- `batchValidators` - Input validation and sanitization

## API Endpoints

### Upload Batch
```
POST /api/batches/upload
Headers:
  - Authorization: Bearer {token}
  - Content-Type: multipart/form-data
Body:
  - file: File (max 10MB)
Response: {
  id: string,
  status: string,
  message: string
}
```

### Get Batch Status
```
GET /api/batches/{id}/status
Response: {
  id: string,
  status: string,
  progress: number,
  errorMessage?: string
}
```

### List Batches
```
GET /api/batches?status={status}&page={page}&limit={limit}
Response: {
  batches: [],
  total: number,
  page: number,
  limit: number
}
```

### Delete Batch
```
DELETE /api/batches/{id}
Response: 204 No Content
```

### Retry Failed Batch
```
POST /api/batches/{id}/retry
Response: {
  id: string,
  status: string,
  message: string
}
```

### Get Batch Statistics
```
GET /api/batches/stats
Response: {
  total: number,
  uploaded: number,
  parsing: number,
  parsed: number,
  loaded: number,
  error: number
}
```

### Get Recent Batches
```
GET /api/batches/recent?limit={limit}
Response: [{
  id: string,
  fileName: string,
  fileSize: number,
  status: string,
  createdAt: Date,
  updatedAt: Date
}]
```

## File Storage

Files are stored in SeaweedFS (or local storage in development) with the following structure:
```
/buckets/files/batches/{user_email}/{filename}
```

## Database Schema

### PostgreSQL - batches table
- Stores batch metadata and status
- Tracks file location and processing state
- Links to user account

### Cassandra - batch_records table
- Stores parsed contact records
- Linked to batch via batch_id
- Supports high-volume data

## Async Processing

After upload, batches are queued for async processing:
1. File uploaded to storage
2. Batch record created in database
3. Job queued in Redis via BullMQ
4. Worker process picks up job (separate feature)
5. Status updated as processing progresses

## Security

- Authentication required for all endpoints
- File size limited to 10MB
- File types restricted to .csv, .txt, .vcf, .xls, .xlsx
- Filename and email sanitization to prevent path traversal
- Users can only access their own batches

## Configuration

Required environment variables:
```bash
# Storage
USE_LOCAL_STORAGE=true|false
SEAWEEDFS_ENDPOINT=http://...
SEAWEEDFS_ACCESS_KEY=...
SEAWEEDFS_SECRET_KEY=...
SEAWEEDFS_BUCKET=templates

# Redis (for job queue)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=...

# File limits
MAX_FILE_SIZE=10485760 # 10MB in bytes
```

## Error Handling

All errors are handled with appropriate HTTP status codes:
- 400: Bad Request (validation errors)
- 401: Unauthorized (no authentication)
- 404: Not Found (batch doesn't exist)
- 413: Payload Too Large (file too big)
- 500: Internal Server Error

## Testing

Test files should cover:
- File upload validation
- Storage integration
- Database operations
- Queue operations
- Error scenarios
- Authentication/authorization