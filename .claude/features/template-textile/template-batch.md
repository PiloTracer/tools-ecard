# Template Batch - Batch Export Sub-Feature

## Purpose
Batch export system that combines templates with contact record data to generate personalized images at scale. Integrates with batch upload feature to populate templates with vCard data.

## Scope
- Batch record management and pagination
- Template population with batch data (mail merge)
- vCard generation for QR codes
- Batch image export (PNG/JPG)
- ZIP archive creation
- Progress tracking and cancellation
- Error handling and retry logic

## Key Files

### Frontend Components
- `components/OffscreenExport/OffscreenExportButton.tsx` - Export modal with batch mode
  - Single vs Batch mode toggle
  - Batch selection dropdown
  - Export settings (format, dimensions, background)
  - Progress tracking UI
  - Cancellation dialog

### Frontend Services
- `services/batchExportService.ts` - Batch export orchestration
  - `fetchBatchRecords(batchId)` - Fetch all records with pagination
  - `applyRecordData(template, record)` - Populate template with record data
  - `exportTemplateToBatch(template, batchId, options)` - Main export function
  - `createZipArchive(exports)` - Create ZIP file
  - `downloadZip(blob, filename)` - Download ZIP

- `services/vcardGenerator.ts` - vCard generation utilities
  - `generateVCardFromRecord(record)` - Generate vCard from batch record
  - `generateVCardFromElements(elements)` - Generate vCard from template elements

### Backend (Batch View Feature - Integration Point)
- `features/batch-view/` - Batch CRUD and record management
  - Batch upload (CSV/vCard parsing)
  - Record storage (Cassandra)
  - Record pagination API

## Batch Record Types

### Frontend TypeScript
```typescript
interface BatchRecord {
  batchRecordId: string;
  batchId: string;
  createdAt: Date;
  updatedAt: Date;

  // Core fields
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;

  // Contact
  workPhone: string | null;
  workPhoneExt: string | null;
  mobilePhone: string | null;
  email: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostal: string | null;
  addressCountry: string | null;

  // Social
  socialInstagram: string | null;
  socialTwitter: string | null;
  socialFacebook: string | null;

  // Business
  businessName: string | null;
  businessTitle: string | null;
  businessDepartment: string | null;
  businessUrl: string | null;
  businessHours: string | null;

  // Business Address
  businessAddressStreet: string | null;
  businessAddressCity: string | null;
  businessAddressState: string | null;
  businessAddressPostal: string | null;
  businessAddressCountry: string | null;

  // Professional
  businessLinkedin: string | null;
  businessTwitter: string | null;

  // Personal
  personalUrl: string | null;
  personalBio: string | null;
  personalBirthday: string | null;
}
```

## Field Mapping (Template ↔ Record)

### Field ID Convention
Template text elements use `fieldId` attribute with snake_case:
- `full_name` → `record.fullName`
- `work_phone` → `record.workPhone`
- `business_title` → `record.businessTitle`

### Mapping Dictionary
```typescript
const FIELD_ID_TO_PROPERTY_MAP: Record<string, string> = {
  'full_name': 'fullName',
  'first_name': 'firstName',
  'last_name': 'lastName',
  'work_phone': 'workPhone',
  'mobile_phone': 'mobilePhone',
  'email': 'email',
  'business_title': 'businessTitle',
  // ... etc
};
```

## Batch Export Flow

### 1. User Initiates Export
- User clicks "Batch Export" button
- Selects batch from dropdown (only LOADED batches shown)
- Configures export options:
  - Format: PNG or JPG
  - Dimensions: width (height auto-calculated)
  - Transparent toggle (on/off)
  - Background color (from template)

### 2. Fetch Batch Records
```typescript
const { records, batchName } = await fetchBatchRecords(batchId);
// Handles pagination automatically (500 records per page)
// Memory limit: 2000 records max
```

### 3. Process Each Record
For each record in batch:
1. **Apply record data**: `applyRecordData(template, record)`
   - Clone template (avoid mutation)
   - Map fieldId → record property
   - Replace text content
   - Update text elements

2. **Generate vCard for QR codes**:
   ```typescript
   const vCardData = generateVCardFromRecord(record);
   // Update all QR elements with vCard
   ```

3. **Export to image**:
   ```typescript
   await exportTemplate(populatedTemplate, {
     format,
     width,
     backgroundColor,
     // ... options
   });
   ```

4. **Generate filename**:
   ```
   {batchName}_{index}_{fullName}.{format}
   Example: BD_Firmas_001_John_Doe.png
   ```

5. **Add to ZIP**:
   - Store data URL in memory
   - Add to exports array

6. **Update progress**:
   ```typescript
   onProgress(current, total, status);
   ```

7. **Check cancellation**:
   ```typescript
   if (onCancel && onCancel()) {
     return { cancelled: true, ... };
   }
   ```

### 4. Create ZIP Archive
```typescript
const zipBlob = await createZipArchive(exports);
// DEFLATE compression, level 6
```

### 5. Download ZIP
```typescript
downloadZip(zipBlob, `${batchName}_export.zip`);
```

## vCard Generation

### From Record (Batch Export)
```typescript
generateVCardFromRecord(record: BatchRecord): string
// Returns vCard 3.0 format with all available fields
```

### From Template Elements (Single Export)
```typescript
generateVCardFromElements(elements: TemplateElement[]): string
// Extracts fieldId values from text elements
// Used for QR code generation in single exports
```

### vCard Format
```
BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
TITLE:Senior Engineer
ORG:ACME Corp
TEL;TYPE=WORK,VOICE:555-1234
TEL;TYPE=CELL:555-5678
EMAIL;TYPE=INTERNET:john@example.com
ADR;TYPE=WORK:;;123 Main St;City;State;12345;Country
URL:https://example.com
END:VCARD
```

## Performance & Memory Management

### Chunking
- Process records in chunks of 100
- Yield to event loop: `await new Promise(resolve => setTimeout(resolve, 0))`
- Prevents UI freezing on large batches

### Memory Limits
- Warning threshold: 1000 records
- Hard limit: 2000 records (throws error)
- Data URLs held in memory until ZIP creation

### Progress Reporting
```typescript
interface BatchExportResult {
  batchId: string;
  batchName: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  failed: Array<{ recordId: string; error: string }>;
  zipBlob?: Blob;
  cancelled?: boolean;
}
```

## Error Handling

### Record-Level Errors
- Continue processing remaining records
- Track failures in `failed` array
- Report summary at completion

### Batch-Level Errors
- Cancel entire operation
- Throw error to UI
- Show error message

### Cancellation
- User can cancel mid-export
- Options:
  1. Continue export
  2. Cancel & download partial ZIP
  3. Cancel & discard all

## Integration with Batch View Feature

### API Endpoint
```
GET /api/batches/:batchId/records?page=1&pageSize=500
```

Response:
```typescript
{
  success: boolean;
  data: {
    batchId: string;
    batchFileName: string;
    batchStatus: string;  // LOADED, PROCESSING, ERROR, etc.
    records: BatchRecord[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  };
}
```

### Batch Statuses
Only batches with status `LOADED` can be exported:
- `UPLOADED` - File uploaded, not parsed
- `PROCESSING` - Parsing in progress
- `LOADED` - Ready for export ✅
- `ERROR` - Parse failed

## Dependencies

### Internal
- **template-textile-core** - Uses exportService for image generation
- **batch-view** - Batch CRUD and record storage (API)

### External
- `jszip` - ZIP archive creation
- `@/shared/lib/api-client` - API communication
- `fabric.js` - Canvas rendering (via exportService)

## File Naming Convention

### Sanitization Rules
```typescript
sanitizeFilename(name: string): string
// Replace special chars with '_'
// Replace spaces with '_'
// Collapse multiple '_'
// Limit to 50 characters
```

### Format
```
{batchName}_{index}_{recordName}.{format}
BD_Firmas_03_07_001_John_Doe.png
```

## Migration Notes

When moving to `features/template-batch/`:
1. Move `services/batchExportService.ts` → `features/template-batch/services/batchExportService.ts`
2. Move `services/vcardGenerator.ts` → `features/template-batch/services/vcardGenerator.ts`
3. Move `components/OffscreenExport/` → Keep in core (triggers both single + batch)
   - OR split into single export (core) + batch export (batch feature)
4. Update imports in template-textile-core
5. Export public API from `features/template-batch/index.ts`

## Public API (for other features)

```typescript
// features/template-batch/index.ts
export { exportTemplateToBatch } from './services/batchExportService';
export { generateVCardFromRecord } from './services/vcardGenerator';
export type { BatchRecord, BatchExportOptions, BatchExportResult } from './types';
```

## Future Enhancements

### Potential Features
- **Background processing** - Use Web Workers for large batches
- **Incremental ZIP** - Stream to ZIP instead of holding all in memory
- **Resume capability** - Save progress, resume failed batches
- **Batch templates** - Save template + batch association
- **Email integration** - Email batch results
- **Cloud export** - Upload to S3/GCS instead of ZIP download

## Notes
- Batch export is INDEPENDENT of template editing
- Uses exportService as shared infrastructure
- Can be used with any template structure
- vCard generation is specific to business card use case (could be generalized)
