● Based on my deep knowledge of the batch implementation, here are my expert
  recommendations:

  1. ✅ Batch Records API Endpoint - EXISTS

  Answer: Yes, it already exists and is production-ready!

  Endpoint: GET /api/batches/:batchId/records

  Location:
  - Controller:
  api-server/src/features/batch-records/controllers/batchRecordController.ts (line 33)       
  - Route: /api/batches/:batchId/records (registered in app.ts line 118-120)

  Returns:
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

  Key Features:
  - ✅ Returns complete data (PostgreSQL + Cassandra merged)
  - ✅ Supports pagination (?page=1&pageSize=50)
  - ✅ Supports search (?search=john)
  - ✅ User authentication & ownership verified
  - ✅ All 30+ vCard fields included

  ---
  2. 🎯 Field Mapping Fallback - A) Keep Placeholder

  Recommendation: Keep placeholder text

  Reasoning:
  1. Visual feedback - User sees which fields are missing
  2. No silent failures - Obvious if data is incomplete
  3. QR code survives - Card is still generated
  4. Matches template preview - Consistent behavior

  Implementation:
  const fieldValue = record[fieldId] || template.elements[i].placeholder || '';

  Alternative for critical fields:
  // For QR code data field (must not be blank)
  if (fieldId === 'qr_data' && !record[fieldId]) {
    throw new Error(`Record ${record.id}: QR data is required`);
  }

  ---
  3. 📁 File Naming Convention - A) contacts_001_John_Doe.png

  Recommendation: contacts_001_John_Doe.png

  Reasoning:
  1. Sortable - Numeric prefix keeps order
  2. Identifiable - Name helps find specific person
  3. Safe - Sanitized name prevents filesystem issues
  4. Consistent - Matches batch naming pattern

  Implementation:
  function sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50); // Prevent too-long names
  }

  const filename = `contacts_${String(index + 1).padStart(3, 
  '0')}_${sanitizeFilename(record.fullName || 'unnamed')}.png`;
  // contacts_001_John_Doe.png
  // contacts_002_Jane_Smith.png

  Fallback for missing names:
  const name = record.fullName || record.email || record.batchRecordId.slice(0, 8);

  ---
  4. 🔄 Error Strategy - A) Skip & Continue

  Recommendation: Skip failed records, show summary at end

  Reasoning:
  1. User-friendly - Gets partial results instead of nothing
  2. Batch mindset - Exporting 500 cards shouldn't fail due to 1 bad record
  3. Actionable errors - Summary shows which records need fixing
  4. Resume possible - Re-run export only for failed records

  Implementation:
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

  return {
    totalProcessed: records.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    failedRecords: results.failed, // Show in UI
  };

  ---
  5. ⚠️ Memory Limits - C) Warning + Chunking

  Recommendation: Warning at 1000+, enforce chunking for 2000+

  Reasoning:
  1. Browser limits - JSZip can handle ~500MB before slowdown
  2. User experience - Progress bar prevents "Is it frozen?" confusion
  3. Flexibility - Power users can proceed with warning

  Implementation:
  const BATCH_SIZE = 100; // Process in chunks
  const WARN_THRESHOLD = 1000;
  const MAX_THRESHOLD = 2000;

  if (recordCount > MAX_THRESHOLD) {
    throw new Error(`Batch too large (${recordCount} records). Maximum is 
  ${MAX_THRESHOLD}. Please filter or split batch.`);
  }

  if (recordCount > WARN_THRESHOLD) {
    showWarning(`Large batch (${recordCount} records). This may take several minutes.        
  Continue?`);
  }

  // Process in chunks to avoid memory spikes
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    await processChunk(chunk);
    updateProgress((i + chunk.length) / records.length * 100);
  }

  ---
  6. 🏗️ Template State - B) Clone for each (with restore)

  Recommendation: Clone template for each record, restore between batches

  Reasoning:
  1. Isolation - Each record gets pristine template
  2. Parallel-ready - Could process multiple records simultaneously later
  3. Safety - No risk of state leakage between records

  Implementation:
  // At batch start
  const templateSnapshot = JSON.parse(JSON.stringify(originalTemplate));

  // For each record
  for (const record of records) {
    // Deep clone template for this record
    const recordTemplate = JSON.parse(JSON.stringify(templateSnapshot));

    // Apply field mappings
    recordTemplate.elements.forEach(el => {
      if (el.fieldId) {
        el.text = record[el.fieldId] || el.placeholder || '';
      }
    });

    // Render
    await renderToCanvas(recordTemplate);

    // recordTemplate is garbage collected after this iteration
  }

  Performance note: JSON.stringify/parse is fast for typical template sizes (<100KB). For    
   huge templates, consider structured cloning or Canvas API cloning.

  ---
  7. 🛑 Cancellation - C) Let User Choose

  Recommendation: Show dialog with options

  Reasoning:
  1. User control - Respects their effort and bandwidth
  2. Partial success useful - 400/500 cards is still valuable
  3. Network consideration - May have already downloaded data

  Implementation:
  // When user clicks cancel
  const dialog = {
    title: 'Cancel Export?',
    message: `Processed ${completed} of ${total} records 
  (${Math.round(completed/total*100)}%)`,
    options: [
      {
        label: 'Download Partial ZIP',
        value: 'partial',
        description: `Get ${completed} completed cards`
      },
      {
        label: 'Discard All',
        value: 'discard',
        description: 'Start over next time'
      },
      {
        label: 'Continue',
        value: 'continue',
        description: 'Keep processing'
      },
    ],
  };

  if (result === 'partial') {
    await zip.generateAsync({ type: 'blob' });
    downloadZip(blob, `${batchName}_partial_${completed}_cards.zip`);
  }

  ---
  8. 💾 Progress Persistence - A) No (MVP)

  Recommendation: Not resumable for MVP

  Reasoning:
  1. Complexity - Requires server-side job queue (BullMQ), S3 storage, job tracking
  2. Rare need - Most batches complete in <5 minutes
  3. Browser context - Users typically don't close tabs mid-export
  4. Alternative exists - Re-run with filters if needed

  Future Enhancement (Post-MVP):
  If you later need resumable exports:
  // POST /api/batches/:batchId/export/start
  {
    templateId: string,
    recordIds?: string[], // Optional filter
  }

  // Returns job ID for polling
  {
    jobId: 'abc123',
    status: 'processing',
    progress: 0,
  }

  // GET /api/export-jobs/:jobId
  {
    status: 'completed' | 'processing' | 'failed',
    progress: 87,
    downloadUrl: 's3://...' // When completed
  }

  For MVP: Just show good progress UI and disable navigation:
  window.onbeforeunload = (e) => {
    if (isExporting) {
      e.preventDefault();
      return 'Export in progress. Are you sure you want to leave?';
    }
  };

  ---
  🎯 Bonus Recommendation: Progress UI

  Given the existing batch status tracking, implement real-time progress:

  // Client-side
  const [progress, setProgress] = useState({
    current: 0,
    total: recordCount,
    stage: 'fetching' | 'rendering' | 'zipping',
  });

  // Stages:
  // 1. Fetching records (5%)
  // 2. Rendering PNGs (85% - bulk of time)
  // 3. Creating ZIP (10%)

  <ProgressBar>
    <div>Exporting cards: {progress.current}/{progress.total}</div>
    <div>Stage: {progress.stage}</div>
    <LinearProgress value={(progress.current / progress.total) * 100} />
  </ProgressBar>

  ---
  Summary Table

  | Question          | Recommendation        | Complexity | User Impact        |
  |-------------------|-----------------------|------------|--------------------|
  | 1. API Endpoint   | ✅ Use existing        | None       | Perfect fit        |
  | 2. Missing Fields | Keep placeholder      | Low        | Prevents confusion |
  | 3. File Naming    | contacts_001_Name.png | Low        | Easy to find       |
  | 4. Error Handling | Skip & summarize      | Medium     | Best UX            |
  | 5. Memory Limits  | Warning + chunking    | Medium     | Prevents crashes   |
  | 6. Template State | Clone per record      | Low        | Safest             |
  | 7. Cancellation   | User choice dialog    | Medium     | Respects effort    |
  | 8. Resumable      | No (MVP)              | N/A        | Keep it simple     |

  All recommendations prioritize user experience while keeping implementation simple and     
  robust for MVP. The existing batch infrastructure supports all of this perfectly! 🚀   