# Batch Upload Feature (Frontend)

## Purpose
Provides user interface components and services for batch file upload functionality, including drag-and-drop file selection, upload progress tracking, and batch status monitoring.

## Components

### FileUploadComponent
A reusable drag-and-drop file upload component with validation.

```tsx
import { FileUploadComponent } from '@/features/batch-upload';

<FileUploadComponent
  onSuccess={(batch) => console.log('Uploaded:', batch)}
  onError={(error) => console.error('Error:', error)}
  acceptedFileTypes={['.csv', '.txt', '.vcf', '.xls', '.xlsx']}
  maxFileSize={10 * 1024 * 1024} // 10MB
/>
```

**Props:**
- `onSuccess`: Callback when upload succeeds
- `onError`: Callback when upload fails
- `acceptedFileTypes`: Array of allowed file extensions
- `maxFileSize`: Maximum file size in bytes
- `className`: Additional CSS classes

### BatchStatusTracker
Displays real-time status of a batch processing job.

```tsx
import { BatchStatusTracker } from '@/features/batch-upload';

<BatchStatusTracker
  batchId="batch-123"
  onComplete={(batch) => console.log('Complete:', batch)}
  onError={(error) => console.error('Error:', error)}
/>
```

**Props:**
- `batchId`: ID of the batch to track
- `onComplete`: Callback when processing completes
- `onError`: Callback when error occurs
- `className`: Additional CSS classes

## Hooks

### useBatchUpload
React hook for managing batch upload operations.

```tsx
import { useBatchUpload } from '@/features/batch-upload';

function MyComponent() {
  const {
    isUploading,
    uploadProgress,
    uploadError,
    batches,
    uploadBatch,
    fetchBatches,
    deleteBatch,
    retryBatch,
  } = useBatchUpload();

  const handleUpload = async (file: File) => {
    const result = await uploadBatch(file);
    if (result) {
      console.log('Upload successful:', result);
    }
  };

  // ...
}
```

**Returns:**
- State:
  - `isUploading`: Upload in progress
  - `uploadProgress`: Upload progress (0-100)
  - `uploadError`: Error message if any
  - `batches`: Array of batch records
  - `batchStats`: Statistics object
- Actions:
  - `uploadBatch(file)`: Upload a file
  - `fetchBatches(params)`: Get list of batches
  - `deleteBatch(id)`: Delete a batch
  - `retryBatch(id)`: Retry failed batch
  - `fetchBatchStats()`: Get statistics
  - `fetchRecentBatches(limit)`: Get recent batches
  - `clearError()`: Clear error state

## Services

### batchService
Service for API communication.

```tsx
import { batchService } from '@/features/batch-upload';

// Upload a file
const response = await batchService.uploadBatch(file);

// Get batch status
const status = await batchService.getBatchStatus(batchId);

// List batches
const batches = await batchService.listBatches({
  status: BatchStatus.PARSED,
  page: 1,
  limit: 20,
});
```

## Types

### BatchStatus Enum
```typescript
enum BatchStatus {
  UPLOADED = 'UPLOADED',
  PARSING = 'PARSING',
  PARSED = 'PARSED',
  LOADED = 'LOADED',
  ERROR = 'ERROR'
}
```

### Batch Interface
```typescript
interface Batch {
  id: string;
  fileName: string;
  fileSize: number;
  status: BatchStatus;
  errorMessage?: string | null;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
}
```

## Usage Example

### Complete Upload Flow

```tsx
'use client';

import { useState } from 'react';
import {
  FileUploadComponent,
  BatchStatusTracker,
  useBatchUpload
} from '@/features/batch-upload';

export default function BatchUploadPage() {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const { batches, fetchRecentBatches } = useBatchUpload();

  const handleUploadSuccess = (batch: BatchUploadResponse) => {
    setCurrentBatchId(batch.id);
    fetchRecentBatches();
  };

  const handleUploadError = (error: Error) => {
    console.error('Upload failed:', error);
  };

  const handleBatchComplete = (batch: BatchStatusResponse) => {
    console.log('Batch processing complete:', batch);
    setCurrentBatchId(null);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Batch Upload</h1>

      {/* Upload Component */}
      <FileUploadComponent
        onSuccess={handleUploadSuccess}
        onError={handleUploadError}
      />

      {/* Status Tracker */}
      {currentBatchId && (
        <div className="mt-4">
          <BatchStatusTracker
            batchId={currentBatchId}
            onComplete={handleBatchComplete}
          />
        </div>
      )}

      {/* Recent Batches */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Recent Batches</h2>
        <div className="space-y-2">
          {batches.map((batch) => (
            <div key={batch.id} className="p-3 bg-gray-50 rounded">
              <span className="font-medium">{batch.fileName}</span>
              <span className="ml-2 text-sm text-gray-600">
                Status: {batch.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Styling

Components use Tailwind CSS classes for styling. Customize appearance by:
1. Passing `className` prop to components
2. Overriding default Tailwind classes
3. Using CSS modules for component-specific styles

## Development

### Mock Mode
During development, the service uses mock implementations:
- `uploadBatchMock`: Simulates file upload with delay
- `getBatchStatusMock`: Returns random status updates

To switch to real API:
1. Remove `Mock` suffix from service method calls
2. Ensure API server is running
3. Configure authentication tokens

### Testing
```bash
# Run tests
npm test -- features/batch-upload

# Test specific component
npm test -- FileUploadComponent
```

## Configuration

Environment variables:
```bash
NEXT_PUBLIC_API_URL=http://localhost:7400
```

## Error Handling

All components handle errors gracefully:
- Validation errors shown inline
- Network errors displayed with retry options
- File size/type errors prevent upload
- Authentication errors redirect to login

## Performance Considerations

- File validation happens client-side before upload
- Progress updates use throttled setState
- Status polling uses 3-second intervals
- Large file uploads use chunking (future enhancement)

## Future Enhancements

1. Chunked upload for large files
2. Multiple file selection
3. Drag multiple files at once
4. Upload queue management
5. Cancel upload in progress
6. Resume interrupted uploads
7. WebSocket for real-time status
8. File preview before upload