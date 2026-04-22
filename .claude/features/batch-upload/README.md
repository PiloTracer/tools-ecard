# Batch Upload Feature

File upload management for batch card generation with SeaweedFS storage and async job processing.

## Overview

Handles batch file uploads (.csv, .txt, .vcf, .xlsx), stores files in SeaweedFS, tracks metadata in PostgreSQL, and queues jobs for async processing via BullMQ.

## User Stories

- As a user, I want to upload contact files for batch card generation
- As a user, I want to track upload status and progress
- As a user, I want to see my upload history
- As a user, I want to retry failed uploads
- As a user, I want to delete uploaded batches

## Key Workflows

### 1. Upload Batch File
1. User selects file (.csv, .txt, .vcf, .xlsx)
2. File uploaded via multipart form
3. File validated (type, size, format)
4. File stored in SeaweedFS
5. Batch record created in PostgreSQL
6. Job queued in Redis for parsing
7. Upload confirmation returned to user

### 2. Track Batch Status
1. User requests batch status
2. System returns current state (uploaded, parsing, parsed, error)
3. Progress percentage provided
4. Error messages shown if applicable

### 3. List User Batches
1. User views batch list
2. Batches filtered by status/date
3. Paginated results returned
4. Statistics displayed (total, parsed, failed)

## Dependencies

- **Depends on:** s3-bucket (file storage)
- **Used by:** batch-parsing, batch-records, batch-view

## Security Considerations

- File type whitelist (.csv, .txt, .vcf, .xlsx only)
- Size limit 10MB per file
- User can only access own batches
- Filename sanitization to prevent path traversal
- Authentication required for all endpoints

## Configuration

- `MAX_FILE_SIZE`: 10MB
- `ALLOWED_FILE_TYPES`: .csv,.txt,.vcf,.xls,.xlsx
- Redis queue: `card-batches`
