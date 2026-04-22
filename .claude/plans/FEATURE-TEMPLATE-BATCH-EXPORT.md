# Feature Plan: Template Batch Export (template-batch-export)

## Overview
**Feature Name:** `template-batch-export`
**Purpose:** Export template-textile templates populated with batch record data, generating one PNG per record
**Status:** ✅ **APPROVED - Ready for Implementation**
**Priority:** High
**Complexity:** Medium (simplified with existing API)
**Estimated Effort:** 6-8 hours (reduced from 8-12h, no backend work needed!)

---

## User Story

**As a** user with a saved template and uploaded contact batch,
**I want to** export personalized images for all contacts in the batch,
**So that I can** generate customized cards/graphics for each person automatically.

---

## Feature Requirements

### Functional Requirements

1. **Batch Selection UI**
   - Add batch dropdown to existing "Batch Export" modal (OffscreenExportButton)
   - Dropdown shows: Batch filename + creation date
   - Load batches in descending order (newest first)
   - Default to "No batch selected" or first batch

2. **Batch Data Retrieval**
   - Fetch list of user's batches via existing `batchViewService.fetchBatches()`
   - Fetch all records for selected batch via API endpoint (needs creation/verification)
   - Support batches with 1-10,000+ records

3. **Field Mapping & Population**
   - For each batch record:
     - Scan template for TextElements with `fieldId` attribute
     - Map `fieldId` (e.g., `full_name`) to batch record field
     - Replace text content with record value
     - Handle missing fields gracefully (keep original or use placeholder)
   - Supported fields: All 30+ vCard fields from `vcardFields.ts`

4. **Sequential Export Process**
   - Export one record at a time (prevent race conditions)
   - For each record:
     1. Clone template in memory
     2. Apply field mappings
     3. Export to PNG via existing `exportService.exportTemplate()`
     4. Add PNG to ZIP archive
     5. Restore template to original state (or use fresh clone)
   - Progress tracking: "Exporting 45/100..."

5. **ZIP Packaging**
   - Package all exported PNGs into single `.zip` file
   - Filename format: `{templateName}_{batchName}_{timestamp}.zip`
   - Individual file naming: `{batchName}_{recordIndex}_{full_name}.png`
   - Automatic browser download when complete

6. **Progress & Cancellation**
   - Real-time progress bar (0-100%)
   - Show current record being processed
   - Cancel button to abort mid-export
   - Estimated time remaining (optional)

7. **Error Handling**
   - Skip failed records or stop entire batch (configurable)
   - Log errors with record ID/index
   - Show summary: "95/100 succeeded, 5 failed"
   - Download partial ZIP if some records fail

### Non-Functional Requirements

1. **Performance**
   - Process 100 records in < 60 seconds (target: 0.6s/record)
   - Memory-efficient: Process in chunks (e.g., 10 records at a time)
   - Off-screen canvas reuse to avoid DOM bloat
   - Stream ZIP creation (don't hold all PNGs in memory)

2. **Memory Management**
   - Limit concurrent operations (1 export at a time)
   - Revoke blob URLs after adding to ZIP
   - Dispose canvas resources properly
   - Clear template clone after each record

3. **UX/UI**
   - Disable export button during processing
   - Show clear progress indicator
   - Prevent modal close during export
   - Success/error notifications
   - Download prompt when ready

4. **Data Integrity**
   - Validate batch exists and user has access
   - Verify template has field mappings before starting
   - Ensure record count matches expected
   - Handle concurrent batch modifications gracefully

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User: Clicks "Batch Export" Button                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  OffscreenExportButton Modal                                │
│  - Format: PNG/JPG                                          │
│  - Resolution: 600-5000px                                   │
│  - Quality: 10-100%                                         │
│  - NEW: Batch Selection Dropdown ◄─────────────────────┐   │
└────────────────┬────────────────────────────────────────┘   │
                 │                                             │
                 ├─→ Load batches                              │
                 │   batchViewService.fetchBatches()           │
                 │   Sort by createdAt DESC ───────────────────┘
                 │
                 ├─→ User selects batch
                 │
                 ├─→ User clicks "Export"
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  BatchExportService.exportTemplateToBatch()                 │
│                                                              │
│  1. Validate inputs                                         │
│     - Template has field mappings?                          │
│     - Batch exists and accessible?                          │
│                                                              │
│  2. Fetch batch records                                     │
│     - API: GET /api/batches/{batchId}/records               │
│     - Load all records (pagination if needed)               │
│     - Extract vCard data from Cassandra                     │
│                                                              │
│  3. Initialize ZIP writer                                   │
│     - JSZip library                                         │
│     - Stream mode for memory efficiency                     │
│                                                              │
│  4. For each record (sequential):                           │
│     ┌──────────────────────────────────────────────┐       │
│     │ a. Clone template                            │       │
│     │    const templateClone = cloneTemplate()     │       │
│     │                                               │       │
│     │ b. Apply field mappings                      │       │
│     │    applyRecordData(templateClone, record)    │       │
│     │    - Find TextElements with fieldId          │       │
│     │    - Replace text with record[fieldId]       │       │
│     │    - Handle missing fields                   │       │
│     │                                               │       │
│     │ c. Export to PNG                             │       │
│     │    const result = await exportTemplate(...)  │       │
│     │                                               │       │
│     │ d. Add to ZIP                                │       │
│     │    zip.file(filename, dataUrlToBlob(result)) │       │
│     │                                               │       │
│     │ e. Cleanup                                   │       │
│     │    - Revoke blob URLs                        │       │
│     │    - Clear template clone                    │       │
│     │                                               │       │
│     │ f. Update progress                           │       │
│     │    onProgress(current, total)                │       │
│     └──────────────────────────────────────────────┘       │
│                                                              │
│  5. Finalize ZIP                                            │
│     - Generate ZIP blob                                     │
│     - Trigger browser download                              │
│     - Show success message                                  │
│                                                              │
│  6. Error handling                                          │
│     - Log failed records                                    │
│     - Continue or abort based on config                     │
│     - Return export summary                                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### 1. Batch List Retrieval
```typescript
// Frontend
const batches = await batchViewService.fetchBatches({
  page: 1,
  pageSize: 100,
  filters: { sortBy: 'createdAt', sortOrder: 'desc' }
});

// Response
{
  batches: [
    {
      id: 'batch-uuid',
      fileName: 'contacts_2024.csv',
      status: 'LOADED',
      recordsCount: 150,
      createdAt: '2024-11-26T10:00:00Z'
    }
  ],
  total: 1,
  page: 1,
  limit: 100
}
```

#### 2. Batch Records Retrieval
```typescript
// NEW ENDPOINT NEEDED
// GET /api/batches/{batchId}/records

// Response
{
  records: [
    {
      id: 'record-uuid',
      batchId: 'batch-uuid',
      rowIndex: 0,
      vcardData: {
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        work_phone: '+1-555-1234',
        mobile_phone: '+1-555-5678',
        business_name: 'Acme Corp',
        business_title: 'CEO',
        // ... all 30+ fields
      }
    },
    // ... more records
  ],
  total: 150
}
```

#### 3. Field Mapping
```typescript
// Template has TextElements with fieldId
{
  type: 'text',
  text: 'John Doe',  // Original placeholder
  fieldId: 'full_name',  // Maps to record field
  ...
}

// After applying record data
{
  type: 'text',
  text: 'Jane Smith',  // Replaced with record value
  fieldId: 'full_name',
  ...
}
```

#### 4. ZIP Structure
```
{templateName}_{batchName}_{timestamp}.zip
├── contacts_2024_001_John_Doe.png
├── contacts_2024_002_Jane_Smith.png
├── contacts_2024_003_Bob_Johnson.png
└── ...
```

---

## Implementation Plan

### Phase 1: API Endpoint (Backend)
**Duration:** 2-3 hours

1. **Create batch records endpoint**
   - File: `api-server/src/features/batch-upload/controllers/batchController.ts`
   - Add `getBatchRecords(req, res)` method
   - Validate batch ownership (userId check)
   - Fetch records from PostgreSQL (batch_records table)
   - Fetch full vCard data from Cassandra
   - Support pagination (default: all records)

2. **Add route**
   - File: `api-server/src/features/batch-upload/routes/batchRoutes.ts`
   - Route: `GET /api/batches/:batchId/records`
   - Query params: `page`, `limit` (optional)

3. **Update service**
   - File: `api-server/src/features/batch-upload/services/batchUploadService.ts`
   - Add `getBatchRecords(userId, batchId, options)` method

### Phase 2: Frontend Service (Batch Export)
**Duration:** 3-4 hours

1. **Create batch export service**
   - File: `front-cards/features/template-textile/services/batchExportService.ts`
   - Exports:
     ```typescript
     export async function exportTemplateToBatch(
       template: Template,
       batchId: string,
       options: BatchExportOptions
     ): Promise<BatchExportResult>;

     interface BatchExportOptions extends ExportOptions {
       onRecordProgress?: (current: number, total: number, recordName: string) => void;
       onError?: (recordIndex: number, error: Error) => void;
       stopOnError?: boolean; // Default: false
       chunkSize?: number; // Records per chunk (default: 1 for sequential)
     }

     interface BatchExportResult {
       zipBlob: Blob;
       successful: number;
       failed: number;
       errors: Array<{ recordIndex: number; error: string }>;
     }
     ```

2. **Implement core functions**
   - `fetchBatchRecords(batchId)` - Get all records
   - `applyRecordData(template, record)` - Field mapping
   - `exportRecordSequential(template, record, options)` - Single record export
   - `createZipArchive(exports)` - ZIP packaging
   - `sanitizeFilename(name)` - Safe filename generation

3. **Memory management**
   - Reuse single off-screen canvas
   - Revoke blob URLs after adding to ZIP
   - Process in chunks if needed (future: parallel processing)

### Phase 3: UI Integration
**Duration:** 2-3 hours

1. **Enhance OffscreenExportButton modal**
   - File: `front-cards/features/template-textile/components/OffscreenExport/OffscreenExportButton.tsx`
   - Add batch selection dropdown
   - Add "Enable Batch Export" checkbox (shows/hides dropdown)
   - Load batches on modal open
   - Display batch info (filename, date, record count)

2. **Add progress UI**
   - Progress bar for overall batch
   - Current record indicator: "Processing: John Doe (45/100)"
   - Estimated time remaining (optional)
   - Cancel button

3. **Update export handler**
   - Detect if batch is selected
   - Call `batchExportService.exportTemplateToBatch()` if batch selected
   - Otherwise use single template export (current behavior)
   - Handle ZIP download

### Phase 4: Error Handling & Polish
**Duration:** 1-2 hours

1. **Validation**
   - Check template has at least one field mapping before starting
   - Validate batch exists and is accessible
   - Verify batch status is LOADED (not ERROR or PARSING)

2. **Error recovery**
   - Skip failed records and continue (default)
   - Or stop on first error (configurable)
   - Show summary dialog with success/failure counts
   - Download partial ZIP if some succeeded

3. **User feedback**
   - Success notification: "Exported 150 images successfully!"
   - Error notification: "95/100 succeeded, 5 failed. Check console for details."
   - Cancel confirmation: "Are you sure? Progress will be lost."

---

## Dependencies

### Existing Services (Reuse)
1. ✅ `batchViewService.fetchBatches()` - Get batch list
2. ✅ `exportService.exportTemplate()` - Single template export
3. ✅ `vcardFields.ts` - Field definitions
4. ⚠️ **NEW NEEDED:** API endpoint for batch records retrieval

### New Libraries
1. **JSZip** - ZIP file creation
   - Install: `npm install jszip`
   - Size: ~130KB minified
   - Browser-compatible
   - Supports streaming

2. **FileSaver.js** (optional)
   - Install: `npm install file-saver`
   - Helper for triggering downloads
   - Can use native `<a>` tag as alternative

---

## ✅ Decisions & Answers (APPROVED)

### 1. Batch Records API Endpoint ✅
**Decision:** API endpoint EXISTS and is production-ready!

**Endpoint:** `GET /api/batches/:batchId/records`

**Location:**
- Controller: `api-server/src/features/batch-records/controllers/batchRecordController.ts:33`
- Route: `/api/batches/:batchId/records`

**Response:**
```typescript
{
  success: true,
  data: {
    batchId: string,
    batchFileName: string,
    batchStatus: 'UPLOADED' | 'PARSING' | 'PARSED' | 'LOADED' | 'ERROR',
    records: ContactRecord[], // Full 30+ vCard fields from Cassandra
    pagination: { total, page, pageSize, totalPages }
  }
}
```

**Features:**
- ✅ Complete data (PostgreSQL + Cassandra merged)
- ✅ Pagination support (?page=1&pageSize=50)
- ✅ Search support (?search=john)
- ✅ User authentication & ownership verified
- ✅ All 30+ vCard fields included

**Impact:** No backend work needed! 🎉

---

### 2. Field Mapping Validation ✅
**Decision:** A) Keep original placeholder text

**Reasoning:**
- Visual feedback - user sees which fields are missing
- No silent failures - obvious if data is incomplete
- QR code survives - card is still generated
- Matches template preview - consistent behavior

**Implementation:**
```typescript
const fieldValue = record[fieldId] || element.placeholder || element.text || '';
```

---

### 3. File Naming Convention ✅
**Decision:** A) `contacts_001_John_Doe.png`

**Format:** `{batchName}_{rowIndex}_{fullName}.png`

**Reasoning:**
- Sortable - numeric prefix keeps order
- Identifiable - name helps find specific person
- Safe - sanitized name prevents filesystem issues
- Consistent - matches batch naming pattern

**Implementation:**
```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

const filename = `${batchName}_${String(index + 1).padStart(3, '0')}_${sanitizeFilename(record.fullName || 'unnamed')}.png`;
// Example: contacts_001_John_Doe.png
```

---

### 4. Error Handling Strategy ✅
**Decision:** A) Skip failed records, show summary at end

**Reasoning:**
- User-friendly - gets partial results instead of nothing
- Batch mindset - 500 cards shouldn't fail due to 1 bad record
- Actionable errors - summary shows which records need fixing
- Resume possible - re-run export only for failed records

**Implementation:**
```typescript
const results = {
  success: [] as string[],
  failed: [] as { recordId: string; name: string; error: string }[],
};

for (const record of records) {
  try {
    await generateCard(template, record);
    results.success.push(record.batchRecordId);
  } catch (error) {
    results.failed.push({
      recordId: record.batchRecordId,
      name: record.fullName || 'Unknown',
      error: error.message,
    });
  }
}

// Show summary: "95/100 succeeded, 5 failed"
```

---

### 5. Memory Limits ✅
**Decision:** C) Warning at 1000+, chunking for 2000+

**Thresholds:**
- Warning: 1000 records ("This may take several minutes")
- Maximum: 2000 records (hard limit, suggest filtering)
- Chunk size: 100 records at a time

**Reasoning:**
- Browser limits - JSZip handles ~500MB before slowdown
- User experience - progress bar prevents "frozen?" confusion
- Flexibility - power users can proceed with warning

**Implementation:**
```typescript
const BATCH_SIZE = 100;
const WARN_THRESHOLD = 1000;
const MAX_THRESHOLD = 2000;

if (recordCount > MAX_THRESHOLD) {
  throw new Error(`Batch too large (${recordCount}). Max: ${MAX_THRESHOLD}`);
}

if (recordCount > WARN_THRESHOLD) {
  showWarning(`Large batch (${recordCount} records). Continue?`);
}

// Process in chunks
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const chunk = records.slice(i, i + BATCH_SIZE);
  await processChunk(chunk);
  updateProgress((i + chunk.length) / records.length * 100);
}
```

---

### 6. Template State Management ✅
**Decision:** B) Clone template for each record

**Reasoning:**
- Isolation - each record gets pristine template
- Parallel-ready - could process multiple records later
- Safety - no risk of state leakage between records

**Implementation:**
```typescript
// At batch start
const templateSnapshot = JSON.parse(JSON.stringify(originalTemplate));

// For each record
for (const record of records) {
  // Deep clone for this record
  const recordTemplate = JSON.parse(JSON.stringify(templateSnapshot));

  // Apply field mappings
  recordTemplate.elements.forEach(el => {
    if (el.fieldId) {
      el.text = record[el.fieldId] || el.placeholder || '';
    }
  });

  // Render and export
  await renderToCanvas(recordTemplate);

  // Template clone is garbage collected
}
```

---

### 7. Cancellation Behavior ✅
**Decision:** C) Let user choose (partial/discard/continue)

**Dialog Options:**
1. "Download Partial ZIP" - Get completed cards
2. "Discard All" - Start over next time
3. "Continue" - Keep processing

**Reasoning:**
- User control - respects their effort and bandwidth
- Partial success useful - 400/500 cards is still valuable
- Network consideration - may have already downloaded data

**Implementation:**
```typescript
const dialog = {
  title: 'Cancel Export?',
  message: `Processed ${completed} of ${total} (${Math.round(completed/total*100)}%)`,
  options: [
    { label: 'Download Partial ZIP', value: 'partial' },
    { label: 'Discard All', value: 'discard' },
    { label: 'Continue', value: 'continue' },
  ],
};

if (result === 'partial') {
  await zip.generateAsync({ type: 'blob' });
  downloadZip(blob, `${batchName}_partial_${completed}_cards.zip`);
}
```

---

### 8. Progress Persistence ✅
**Decision:** A) No (MVP) - Not resumable

**Reasoning:**
- Complexity - requires server-side job queue
- Rare need - most batches complete in <5 minutes
- Browser context - users don't typically close tabs mid-export
- Alternative exists - re-run with filters if needed

**MVP Implementation:**
```typescript
// Prevent accidental navigation
window.onbeforeunload = (e) => {
  if (isExporting) {
    e.preventDefault();
    return 'Export in progress. Leave page?';
  }
};
```

**Future Enhancement (Post-MVP):**
- Server-side job queue (BullMQ)
- Background processing
- S3 storage for large batches
- Email notification when complete

---

## Risk Assessment

### High Risk
1. **Memory exhaustion** for large batches (1000+ records)
   - Mitigation: Chunked processing, blob URL cleanup, canvas reuse
2. **Browser tab crash** during long exports
   - Mitigation: Progress indicators, chunk size tuning, memory profiling

### Medium Risk
1. **Race conditions** in concurrent exports
   - Mitigation: Sequential processing (one at a time)
2. **Slow export speed** (>1s per record)
   - Mitigation: Off-screen canvas optimization, parallel chunks (future)

### Low Risk
1. **ZIP file size limits** (browser download limits)
   - Mitigation: Most browsers handle multi-GB files, warn for very large batches
2. **Field mapping errors** (missing fields)
   - Mitigation: Validation before start, graceful fallbacks

---

## Testing Plan

### Unit Tests
1. `applyRecordData()` - Field mapping logic
2. `sanitizeFilename()` - Filename generation
3. `fetchBatchRecords()` - API integration
4. Error handling for missing fields

### Integration Tests
1. Export 10 records → Verify ZIP contents
2. Export with missing fields → Verify fallback behavior
3. Cancel mid-export → Verify cleanup
4. Large batch (100+ records) → Performance test

### Manual Testing
1. Export small batch (5 records) → Success
2. Export medium batch (50 records) → Monitor memory
3. Export large batch (500+ records) → Stress test
4. Template with no field mappings → Show error
5. Batch with malformed data → Handle gracefully

---

## Success Criteria

1. ✅ User can select batch from dropdown
2. ✅ Export generates one PNG per record
3. ✅ Field mappings work for all 30+ vCard fields
4. ✅ ZIP download works in all browsers (Chrome, Firefox, Safari, Edge)
5. ✅ Progress indicator shows real-time status
6. ✅ Export completes without memory errors (up to 1000 records)
7. ✅ Failed records are logged and don't stop batch
8. ✅ Cancel button stops export gracefully
9. ✅ No race conditions or concurrent export issues
10. ✅ Export speed: < 1 second per record (target)

---

## Future Enhancements (Not in MVP)

1. **Parallel Processing**
   - Export multiple records simultaneously (2-5 at a time)
   - Requires careful memory management

2. **Preview Mode**
   - Show first 3 exports before processing full batch
   - Let user verify field mappings

3. **Custom Field Mapping UI**
   - Visual interface to map batch columns to template fields
   - Handle batch fields that don't match vCard standard

4. **Resume Support**
   - Save progress to localStorage
   - Resume from last completed record

5. **Export Templates**
   - Save export configurations (format, resolution, batch)
   - Reuse settings for future exports

6. **Queue System**
   - Background export jobs
   - Email when complete

---

## Files to Create

### Backend
1. ✅ Update `api-server/src/features/batch-upload/controllers/batchController.ts`
   - Add `getBatchRecords()` method

2. ✅ Update `api-server/src/features/batch-upload/services/batchUploadService.ts`
   - Add `getBatchRecords()` service method

3. ✅ Update `api-server/src/features/batch-upload/routes/batchRoutes.ts`
   - Add `/batches/:batchId/records` route

### Frontend
1. ✅ `front-cards/features/template-textile/services/batchExportService.ts`
   - New file, core batch export logic

2. ✅ Update `front-cards/features/template-textile/components/OffscreenExport/OffscreenExportButton.tsx`
   - Add batch selection UI
   - Integrate batch export flow

3. ✅ `front-cards/features/template-textile/types/index.ts`
   - Add batch export types

---

## Timeline Estimate (UPDATED)

| Phase | Task | Duration | Cumulative |
|-------|------|----------|------------|
| ~~1~~ | ~~Backend API endpoint~~ | ~~SKIP~~ | ~~API exists!~~ |
| 1 | Frontend batch service | 3-4h | 3-4h |
| 2 | UI integration | 2-3h | 5-7h |
| 3 | Error handling & polish | 1h | 6-8h |
| **Total** | **All phases** | **6-8h** | **6-8h** |

**Buffer:** +10% for testing (reduced, simpler implementation)
**Final Estimate:** 6-8 hours

**Time Saved:** 2-4 hours (no backend work needed!)

---

## Next Steps

1. **Answer questions above** (especially #1-4, critical for design)
2. **Approve plan** or request modifications
3. **Begin Phase 1** - Backend API endpoint
4. **Iterative implementation** with checkpoints after each phase

---

## Summary of Approved Decisions

| Decision | Choice | Impact |
|----------|--------|--------|
| API Endpoint | ✅ Existing endpoint works perfectly | No backend work! |
| Missing Fields | Keep placeholder text | Visual feedback |
| File Naming | `contacts_001_John_Doe.png` | Sortable & readable |
| Error Handling | Skip & summarize | Best UX |
| Memory Limits | Warn at 1000, max 2000 | Safe & flexible |
| Template State | Clone per record | Safest approach |
| Cancellation | User choice dialog | Respects effort |
| Progress Persistence | No (MVP) | Keep it simple |

---

**Plan Status:** ✅ **APPROVED - Ready for Implementation**
**Estimated Timeline:** 6-8 hours (3 phases, no backend work needed)
**Next Step:** Proceed with Phase 1 implementation
