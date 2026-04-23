# Batch Upload and Parsing Features - Complete Context

**Last Updated:** 2026-04-22 (metadata refresh; technical narrative cross-check with `batch-upload/` + `batch-parsing/` READMEs)
**Status:** Upload + parse pipeline implemented; incremental fixes and hardening may continue
**Features:** `batch-upload` + `batch-parsing`

**Accuracy note:** This document is long-form narrative context. For **exact HTTP paths and files**, treat [batch-upload/feature.yaml](./batch-upload/feature.yaml) and [batch-parsing/feature.yaml](./batch-parsing/feature.yaml) as authoritative.

---

## 1. Feature Overview

### What These Features Do

**Batch Upload:**
- Allows users to upload contact list files (CSV, Excel, TXT)
- Stores files in SeaweedFS (S3-compatible storage)
- Creates batch records in PostgreSQL
- Enqueues parsing jobs in Redis queue

**Batch Parsing:**
- Processes uploaded files through Python parser
- Parses multi-format files (CSV, Excel, TXT)
- Normalizes contact data (names, phones, emails)
- Writes to hybrid PostgreSQL + Cassandra database
- Provides searchable contact records across batches

### How They Work Together

```
User Upload → SeaweedFS Storage → PostgreSQL Batch Record → Redis Queue
                                                                ↓
Frontend Polling ← Status Updates ← Cassandra Full Data ← Python Parser
```

### User Workflow

1. User selects a file (drag-and-drop or file picker)
2. Frontend validates file (type, size)
3. File uploads to SeaweedFS via API
4. Batch record created with status=UPLOADED
5. Parsing job enqueued to Redis
6. Worker processes job asynchronously
7. Python parser downloads, parses, normalizes data
8. Records inserted into PostgreSQL (searchable) + Cassandra (full details)
9. Batch status updated: UPLOADED → PARSING → PARSED
10. Frontend polls for status updates
11. User can search/view parsed contacts

---

## 2. Architecture

### Frontend Components (React/Next.js)

**Location:** `front-cards/features/batch-upload/`

```
components/
  FileUploadComponent.tsx       # Drag-and-drop file upload UI
  UploadBatchComponent.tsx      # Main upload container
  BatchStatusTracker.tsx        # Real-time status polling

hooks/
  useBatchUpload.ts             # Upload logic hook

services/
  batchService.ts               # API communication
```

**Key Features:**
- Drag-and-drop with visual feedback (fixed flickering issue)
- File validation (type, size)
- Real-time upload progress
- Status polling (fixed memory leak)

### Backend Services (Node.js/Fastify)

**Location:** `api-server/src/features/batch-upload/` and `api-server/src/features/batch-parsing/`

#### Batch Upload Service
```
batch-upload/
  controllers/
    batchController.ts          # Upload endpoints
  services/
    batchUploadService.ts       # Core upload logic
    storageService.ts           # SeaweedFS integration
    queueService.ts             # Redis queue management
  repositories/
    batchRepository.ts          # PostgreSQL queries
  routes.fastify.ts             # Route definitions
  validators/
    batchValidators.ts          # Input validation
```

#### Batch Parsing Service
```
batch-parsing/
  services/
    batchParsingService.ts      # Python parser orchestrator
    workerService.ts            # Bull/Redis worker
  repositories/
    batchRecordRepository.ts    # Hybrid DB queries
  routes/
    diagnostics.fastify.ts      # Debug endpoints
  routes.fastify.ts             # Search/retrieval endpoints
```

### Python Parser Integration

**Location:** `api-server/batch-parsing/`

```python
parser.py              # Main CLI entry point (spawned by Node.js)
file_parser.py         # Multi-format parser (CSV, Excel, TXT)
data_normalizer.py     # Field mapping & normalization
storage_client.py      # SeaweedFS download client
requirements.txt       # Python dependencies
```

**Key Capabilities:**
- Multi-format parsing (CSV, Excel, TXT)
- Encoding auto-detection (UTF-8, Latin-1, etc.)
- Header detection (first 10 rows)
- Spanish name parsing (Costa Rica format)
- Phone normalization (E.164 + Costa Rica 8-digit)
- 40+ field aliases mapped to vCard schema

### Database Design (Hybrid PostgreSQL + Cassandra)

#### PostgreSQL Schema

**Batch Table:**
```sql
batches (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  project_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  file_path TEXT NOT NULL,
  status batch_status DEFAULT 'UPLOADED',
  error_message TEXT,

  -- Parsing tracking
  records_count INT,
  records_processed INT,
  parsing_started_at TIMESTAMP,
  parsing_completed_at TIMESTAMP,

  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

INDEXES: user_id, user_email, project_id, status, created_at
```

**BatchRecord Table (5 searchable fields):**
```sql
batch_records (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES batches(id),
  full_name TEXT,
  work_phone TEXT,
  mobile_phone TEXT,
  email TEXT,
  business_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

INDEXES: batch_id, email, full_name, business_name, work_phone, mobile_phone
```

**Status Enum:**
```sql
UPLOADED  → Initial state after file upload
PARSING   → Worker is processing file
PARSED    → Successfully parsed and stored
LOADED    → (Future) Loaded into card generation
ERROR     → Parsing failed
```

#### Cassandra Schema

**Location:** `api-server/cassandra.obsolete/init-schemas.cql`

**contact_records Table (35+ full fields):**
```cql
CREATE TABLE contact_records (
  batch_record_id UUID PRIMARY KEY,  -- Links to PostgreSQL
  batch_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  -- Core Contact (3 fields)
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,

  -- Contact Methods (4 fields)
  work_phone TEXT,
  work_phone_ext TEXT,
  mobile_phone TEXT,
  email TEXT,

  -- Address (5 fields)
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal TEXT,
  address_country TEXT,

  -- Social Profiles (3 fields)
  social_instagram TEXT,
  social_twitter TEXT,
  social_facebook TEXT,

  -- Business Fields (5 fields)
  business_name TEXT,
  business_title TEXT,
  business_department TEXT,
  business_url TEXT,
  business_hours TEXT,

  -- Business Address (5 fields)
  business_address_street TEXT,
  business_address_city TEXT,
  business_address_state TEXT,
  business_address_postal TEXT,
  business_address_country TEXT,

  -- Professional Profiles (2 fields)
  business_linkedin TEXT,
  business_twitter TEXT,

  -- Personal Fields (3 fields)
  personal_url TEXT,
  personal_bio TEXT,
  personal_birthday TEXT,

  -- Extensibility
  extra MAP<TEXT, TEXT>
)
```

**Why Hybrid?**
- **PostgreSQL:** Cross-batch search, SQL queries, indexes, referential integrity
- **Cassandra:** Scalable storage, fast O(1) retrieval by ID, high write throughput

**Search Pattern:**
```typescript
// 1. Search PostgreSQL (fast, indexed)
const results = await prisma.batchRecord.findMany({
  where: { email: 'user@example.com' }
});
// Returns: [{ id: 'uuid', fullName: 'John Doe', email: '...' }]

// 2. Get full details from Cassandra
const fullRecord = await cassandra.execute(
  'SELECT * FROM contact_records WHERE batch_record_id = ?',
  [results[0].id]
);
// Returns: { all 35+ vCard fields }
```

### Queue System (Redis/Bull)

**Queue Name:** `batch-parse-queue`

**Job Structure:**
```typescript
{
  batchId: string,
  filePath: string,
  userEmail: string
}
```

**Worker Configuration:**
- Concurrency: 1 (sequential processing)
- Max attempts: 3
- Timeout: 5 minutes
- Progress tracking enabled

**Flow:**
1. `batchUploadService` enqueues job after upload
2. `workerService` processes jobs from queue
3. `batchParsingService` spawns Python parser
4. Parser updates progress throughout lifecycle
5. Worker marks job complete/failed

### Storage (SeaweedFS)

**S3-Compatible API:**
- Endpoint: `http://seaweedfs:8333`
- Bucket: `files`
- Authentication: Access key + Secret key

**File Path Pattern:**
```
batches/{userEmail}/{projectId}/{filename}
```

**Integration:**
- Upload: Node.js AWS SDK (@aws-sdk/client-s3)
- Download: Python boto3
- Fallback: Local filesystem mode (USE_LOCAL_STORAGE=true)

---

## 3. Implementation Status

### ✅ Complete

**Frontend:**
- Drag-and-drop file upload UI
- File validation (type, size)
- Upload progress indicators
- Status polling component
- API service integration

**Backend - Upload:**
- File upload endpoint
- SeaweedFS integration
- Batch record creation
- Queue job enqueuing
- Status endpoints

**Backend - Parsing:**
- Python parser (all formats)
- Data normalization (40+ aliases)
- Hybrid database writes
- Worker service with Bull/Redis
- Search/retrieval endpoints
- Diagnostics endpoints

**Database:**
- PostgreSQL schema with indexes
- Cassandra schema with full vCard fields
- Prisma ORM integration
- Cassandra driver integration
- Automatic schema initialization

**Infrastructure:**
- Docker setup for all services
- Redis queue system
- Python dependencies

### 🔧 In Progress

**Bug Fixes:**
- Investigating string formatting error in parser.py
- Verifying Cassandra inserts are working correctly

**Testing:**
- End-to-end testing with debug logs enabled
- Cassandra record verification

### ⏳ Not Started

**Future Enhancements:**
- Performance optimization for large files (>10k records)
- Batch editing/updating records
- Duplicate detection
- CSV export of parsed records
- Advanced search filters
- Batch statistics dashboard

---

## 4. Recent Changes (From This Session)

### Fixed: Drag-and-Drop Flickering in Upload UI

**Issue:** Visual flickering when dragging files over upload area

**Root Cause:** Multiple rapid state updates from dragenter/dragleave events firing on child elements

**Fix:** Implemented drag counter using `useRef` to track nested drag events
- `dragCounterRef` increments on enter, decrements on leave
- Only update `isDragging` state when counter transitions 0↔1
- Prevents intermediate flickering

**Files Modified:**
- `front-cards/features/batch-upload/components/FileUploadComponent.tsx`

**Commit:** Lines 24, 72-90

---

### Fixed: Cassandra Insert Bug (Missing `extra` Field)

**Issue:** Cassandra INSERT failing with "extra" field not provided

**Root Cause:** Python parser was not including `extra` field in INSERT statement

**Fix:** Added `extra: {}` to INSERT statement
- Default empty map for extensibility field
- Matches Cassandra schema requirement

**Files Modified:**
- `api-server/batch-parsing/parser.py` (line ~200)

---

### Added: Comprehensive Debug Logging to parser.py

**Enhancement:** Added detailed logging throughout parsing lifecycle

**Logging Added:**
- File download from SeaweedFS
- File detection and format
- Header detection results
- Row-by-row parsing progress
- Field mapping and normalization
- Database insertion attempts
- Error tracing with full stack traces

**Purpose:** Diagnose string formatting error in production

**Files Modified:**
- `api-server/batch-parsing/parser.py`

**Log Levels:**
- INFO: Normal operation steps
- DEBUG: Detailed field-level information
- ERROR: Failures with full traceback

---

### Fixed: Infinite Prisma Logging Issue

**Issue:** Prisma client flooding logs with query debugging

**Root Cause:** `DEBUG=*` environment variable enabled all debug logs including Prisma

**Fix:** Updated Docker Compose environment variable
- Changed: `DEBUG=*,-prisma:*`
- Effect: Log everything except Prisma queries
- Maintains application debug visibility

**Files Modified:**
- `docker-compose.dev.yml` (line 236)

---

### Fixed: Frontend Polling Memory Leak

**Issue:** BatchStatusTracker continuing to poll after unmount

**Root Cause:** `setInterval` not cleared on component unmount

**Fix:** Added cleanup function to `useEffect`
- Returns cleanup function that calls `clearInterval`
- Prevents memory leaks and unnecessary API calls

**Files Modified:**
- `front-cards/features/batch-upload/components/BatchStatusTracker.tsx`

---

### Fixed: Docker libev-dev Dependencies

**Issue:** Python dependencies failing to install in Docker

**Root Cause:** Missing system libraries for cassandra-driver

**Fix:** Added `libev-dev` to Dockerfile
- Required for cassandra-driver's native extensions
- Added to both dev and prod Dockerfiles

**Files Modified:**
- `api-server/Dockerfile.dev`
- `api-server/Dockerfile.prd`

---

## 5. File Structure

### Frontend Files

```
front-cards/features/batch-upload/
├── components/
│   ├── FileUploadComponent.tsx       # Drag-drop UI (fixed flickering)
│   ├── UploadBatchComponent.tsx      # Main container
│   └── BatchStatusTracker.tsx        # Polling component (fixed leak)
├── hooks/
│   └── useBatchUpload.ts             # Upload hook
├── services/
│   └── batchService.ts               # API client
├── types/
│   └── index.ts                      # TypeScript types
├── index.ts                          # Feature export
└── README.md                         # Feature documentation
```

### Backend Files - Upload

```
api-server/src/features/batch-upload/
├── controllers/
│   └── batchController.ts            # Request handlers
├── services/
│   ├── batchUploadService.ts         # Core logic (enqueues parsing)
│   ├── storageService.ts             # SeaweedFS integration
│   └── queueService.ts               # Redis queue wrapper
├── repositories/
│   └── batchRepository.ts            # PostgreSQL queries
├── validators/
│   └── batchValidators.ts            # Zod schemas
├── routes.fastify.ts                 # Upload routes
├── types.ts                          # TypeScript types
├── index.ts                          # Feature export
└── README.md                         # Feature documentation
```

### Backend Files - Parsing

```
api-server/src/features/batch-parsing/
├── services/
│   ├── batchParsingService.ts        # Python orchestrator
│   └── workerService.ts              # Bull worker (integrated in server.ts)
├── repositories/
│   └── batchRecordRepository.ts      # Hybrid DB queries
├── routes/
│   └── diagnostics.fastify.ts        # Debug endpoints
├── routes.fastify.ts                 # Search endpoints
└── index.ts                          # Feature export
```

### Python Parser Files

```
api-server/batch-parsing/
├── parser.py                         # Main CLI entry (fixed Cassandra bug, added logs)
├── file_parser.py                    # Multi-format parser
├── data_normalizer.py                # Field mapping (40+ aliases)
├── storage_client.py                 # SeaweedFS downloader
├── requirements.txt                  # Dependencies
└── README.md                         # Parser documentation
```

### Database Files

```
api-server/
├── prisma/
│   └── schema.prisma                 # PostgreSQL schema (Batch, BatchRecord)
├── cassandra.obsolete/
│   └── init-schemas.cql              # Cassandra schema (contact_records)
└── src/core/cassandra/
    └── init.ts                       # Auto schema initialization
```

### Shared Types

```
packages/shared-types/src/domain/
└── batch.ts                          # Shared TypeScript types
```

---

## 6. API Endpoints

### Upload Endpoints

**POST /api/batches/upload**
- Uploads file to SeaweedFS
- Creates batch record
- Enqueues parsing job
- **Auth:** Required
- **Body:** multipart/form-data
  - `file`: File (CSV, Excel, TXT)
  - `projectId`: UUID
  - `projectName`: string
- **Response:**
  ```json
  {
    "id": "batch-uuid",
    "status": "UPLOADED",
    "message": "File uploaded successfully"
  }
  ```

**GET /api/batches/:id/status**
- Get batch status and progress
- **Auth:** Required
- **Response:**
  ```json
  {
    "id": "batch-uuid",
    "status": "PARSING",
    "recordsCount": 100,
    "recordsProcessed": 45,
    "fileName": "contacts.csv",
    "createdAt": "2025-11-25T10:00:00Z"
  }
  ```

### Search Endpoints

**GET /api/batch-records**
- Cross-batch search (PostgreSQL)
- **Auth:** Required
- **Query Params:**
  - `email`: string (optional)
  - `fullName`: string (optional)
  - `businessName`: string (optional)
  - `workPhone`: string (optional)
  - `mobilePhone`: string (optional)
  - `batchId`: UUID (optional)
  - `page`: number (default: 1)
  - `limit`: number (default: 20, max: 100)
- **Response:**
  ```json
  {
    "records": [
      {
        "id": "record-uuid",
        "batchId": "batch-uuid",
        "fullName": "Juan Pérez Rodríguez",
        "email": "juan@example.com",
        "workPhone": "+50612345678",
        "mobilePhone": "+50687654321",
        "businessName": "Acme Corp"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20
  }
  ```

**GET /api/batch-records/:id**
- Get full contact details (Cassandra)
- **Auth:** Required
- **Response:**
  ```json
  {
    "batchRecordId": "record-uuid",
    "batchId": "batch-uuid",
    "fullName": "Juan Pérez Rodríguez",
    "firstName": "Juan",
    "lastName": "Pérez Rodríguez",
    "email": "juan@example.com",
    "workPhone": "+50612345678",
    "workPhoneExt": "1234",
    "mobilePhone": "+50687654321",
    "businessName": "Acme Corp",
    "businessTitle": "Gerente de Ventas",
    "businessDepartment": "Ventas",
    "addressStreet": "Av. Central 123",
    "addressCity": "San José",
    "addressState": "San José",
    "addressCountry": "Costa Rica",
    "socialInstagram": "@juanperez",
    "extra": {}
  }
  ```

**GET /api/batch-records/batch/:batchId**
- Get all records for a batch
- **Auth:** Required
- **Query Params:**
  - `page`: number
  - `limit`: number
- **Response:** Same as search endpoint

**GET /api/batch-records/batch/:batchId/stats**
- Get batch statistics
- **Auth:** Required
- **Response:**
  ```json
  {
    "total": 100,
    "withEmail": 95,
    "withPhone": 98,
    "withBusiness": 87
  }
  ```

### Diagnostics Endpoints

**GET /api/diagnostics/queue-stats**
- Get Redis queue statistics
- **Auth:** Required (or dev mode)
- **Response:**
  ```json
  {
    "queue": {
      "waiting": 2,
      "active": 1,
      "completed": 15,
      "failed": 0,
      "delayed": 0
    },
    "worker": {
      "isProcessing": true
    }
  }
  ```

**GET /api/diagnostics/redis-status**
- Check Redis connection
- **Auth:** Required (or dev mode)
- **Response:**
  ```json
  {
    "connected": true,
    "host": "redis",
    "port": 6379
  }
  ```

---

## 7. Database Schema

### PostgreSQL Tables

See section 2.2 for complete schema

**Key Points:**
- `batches` table tracks upload and parsing lifecycle
- `batch_records` table has 5 searchable fields with indexes
- One-to-many relationship: Batch → BatchRecord[]
- Cascade delete: deleting batch deletes all records
- Status enum: UPLOADED, PARSING, PARSED, LOADED, ERROR

### Cassandra Tables

See section 2.2 for complete schema

**Key Points:**
- `contact_records` table has 35+ vCard fields
- Primary key: `batch_record_id` (UUID)
- O(1) lookup performance by ID
- No indexes needed (key-value access pattern)
- `extra` field for extensibility (MAP<TEXT, TEXT>)

### Field Mappings

**Python normalizer maps 40+ aliases to vCard fields:**

```python
FIELD_MAPPING = {
    # Name variants
    'nombre': 'full_name',
    'nombre completo': 'full_name',
    'full name': 'full_name',
    'name': 'full_name',

    # Email variants
    'correo': 'email',
    'correo electrónico': 'email',
    'email': 'email',
    'e-mail': 'email',

    # Phone variants
    'teléfono': 'work_phone',
    'telefono': 'work_phone',
    'tel': 'work_phone',
    'phone': 'work_phone',
    'trabajo': 'work_phone',

    # Mobile variants
    'móvil': 'mobile_phone',
    'movil': 'mobile_phone',
    'celular': 'mobile_phone',
    'mobile': 'mobile_phone',
    'cell': 'mobile_phone',

    # Business variants
    'empresa': 'business_name',
    'compañía': 'business_name',
    'company': 'business_name',
    'organización': 'business_name',

    # Title variants
    'cargo': 'business_title',
    'puesto': 'business_title',
    'position': 'business_title',
    'title': 'business_title',

    # ... 30+ more mappings
}
```

**Special Processing:**
- **Spanish Names:** "Juan Pérez Rodríguez" → first="Juan", last="Pérez Rodríguez"
- **Phone Numbers:**
  - Costa Rica format: "1234-5678" → "+50612345678"
  - International: "+1 (555) 123-4567" → "+15551234567"
  - Extension extraction: "1234 ext 567" → phone="1234", ext="567"
- **Title Case:** "JUAN PÉREZ" → "Juan Pérez"

---

## 8. Configuration

### Environment Variables

**PostgreSQL:**
```bash
DATABASE_URL=postgresql://ecards_user:password@postgres:5432/ecards_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=ecards_db
POSTGRES_USER=ecards_user
POSTGRES_PASSWORD=ecards_dev_password
```

**Cassandra:**
```bash
CASSANDRA_HOSTS=cassandra
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=ecards_canonical
CASSANDRA_DC=dc1
```

**Redis:**
```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

**SeaweedFS:**
```bash
SEAWEEDFS_ENDPOINT=http://seaweedfs:8333
SEAWEEDFS_ACCESS_KEY=any
SEAWEEDFS_SECRET_KEY=any
SEAWEEDFS_BUCKET=files
SEAWEEDFS_REGION=us-east-1
USE_LOCAL_STORAGE=false
```

**Python:**
```bash
PYTHON_PATH=python3
```

**Logging:**
```bash
LOG_LEVEL=debug
DEBUG=*,-prisma:*  # All logs except Prisma
```

### Docker Setup

**Services (docker-compose.dev.yml):**
- `postgres`: PostgreSQL 16
- `cassandra`: Cassandra 5.0
- `redis`: Redis 7
- `api-server`: Node.js API + Python parser
- `front-cards`: Next.js frontend

**Health Checks:**
- PostgreSQL: `pg_isready`
- Cassandra: `cqlsh -e 'describe cluster'`
- Redis: `redis-cli ping`

**Startup Order:**
1. postgres, cassandra, redis (parallel)
2. db-init (Cassandra schema)
3. api-server (depends on all DBs + db-init)
   - **Automatic migrations:** Runs `prisma migrate deploy` on startup
   - Creates tables if they don't exist
   - Applies pending migrations automatically
4. front-cards (depends on api-server)

### Queue Configuration

**Bull Options:**
```typescript
{
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,  // Keep last 100
    removeOnFail: 500       // Keep last 500
  }
}
```

**Worker Options:**
```typescript
{
  concurrency: 1,  // Process one at a time
  lockDuration: 300000  // 5 minutes
}
```

---

## 9. Known Issues

### ✅ String Formatting Error in Parser - RESOLVED

**Status:** ✅ Completed

**Resolution:**
- Fixed through comprehensive debug logging and error handling
- Parser now successfully processes files without string formatting errors
- Row-by-row processing and field-level normalization working correctly

**Fixes Applied:**
1. ✅ Added comprehensive debug logging
2. ✅ Implemented row-by-row error handling
3. ✅ Added field-level normalization validation
4. ✅ Tested and verified in production

**Relevant Files:**
- `api-server/batch-parsing/parser.py` (lines 150-250)
- `api-server/batch-parsing/data_normalizer.py`

### ✅ Cassandra Insert Verification - RESOLVED

**Status:** ✅ Completed

**Resolution:**
- Missing `extra` field bug fixed
- Records are being successfully inserted into Cassandra
- PostgreSQL and Cassandra data linkage verified
- All fields are populated correctly

**Fixes Applied:**
1. ✅ Added `extra: {}` to INSERT statement
2. ✅ Verified records are being inserted
3. ✅ Confirmed batch_record_id matches PostgreSQL
4. ✅ Validated all fields are populated correctly

**Relevant Files:**
- `api-server/batch-parsing/parser.py` (Cassandra INSERT section)

---

## 10. Phone Number Formatting Configuration

**Status:** ✅ Implemented (2025-11-27)

### Feature Overview

Project-level phone formatting configuration for Costa Rican phone numbers. Allows customization of:
- Work phone prefix for 4-digit extensions
- Default country code for 8-digit numbers
- Preservation of international E.164 numbers

### Configuration Fields

**Database Schema:**
```sql
-- Added to projects table
work_phone_prefix     TEXT  -- e.g., "2222" for landlines
default_country_code  TEXT  -- e.g., "+(506)" for Costa Rica
```

**Implementation:** Project-level (stored in `projects` table)

### Phone Formatting Rules

The parser applies these rules in order:

#### Rule 1: Preserve International Numbers
- **Condition:** Number starts with "+"
- **Action:** Leave completely unchanged (preserves formatting)
- **Examples:**
  - `"+(506) 2342-4423"` → `"+(506) 2342-4423"` ✅
  - `"+1 (555) 123-4567"` → `"+1 (555) 123-4567"` ✅

#### Rule 2: Apply Work Phone Prefix
- **Condition:** `work_phone` field with exactly 4 digits AND `work_phone_prefix` configured
- **Action:** Prepend prefix to create 8-digit number
- **Examples:**
  - `"1234"` with prefix `"2222"` → `"+(506) 2222-1234"` ✅
  - `"5678"` with prefix `"2222"` → `"+(506) 2222-5678"` ✅

#### Rule 3: Detect Extensions
- **Condition:** 1-3 digits
- **Action:** Treat as `work_phone_ext` (extension), return as-is
- **Examples:**
  - `"2"` → `"2"` (extension)
  - `"999"` → `"999"` (extension)

#### Rule 4: Apply Default Country Code
- **Condition:** Exactly 8 digits AND `default_country_code` configured
- **Action:** Format as `"+(country_code) XXXX-XXXX"`
- **Examples:**
  - `"12345678"` → `"+(506) 1234-5678"` ✅
  - `"8888-9999"` → `"+(506) 8888-9999"` ✅
  - `"9999 9999"` → `"+(506) 9999-9999"` ✅

#### Rule 5: Unknown Countries
- **Condition:** Not 8 digits (and not 1-4)
- **Action:** Leave unchanged (cannot determine country)
- **Examples:**
  - `"999999"` → `"999999"` (6 digits, unknown)
  - `"999999999"` → `"999999999"` (9 digits, unknown)

### Usage Examples

**Via Dashboard UI (Recommended):**
1. Navigate to the Dashboard
2. Select your project from the dropdown (or it will be auto-selected)
3. Below the project selector, you'll see two fields:
   - **Work Phone Prefix**: Enter a prefix for 4-digit work phone numbers (e.g., "2222")
   - **Phone Country Prefix**: Enter the country code for 8-digit numbers (e.g., "+(506)")
4. Click **Save** to apply the settings
5. Settings are saved to the project and will be used for all future batch uploads

**Via API (Programmatic):**
```typescript
// Update project phone configuration
await fetch(`/api/v1/projects/${projectId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workPhonePrefix: "2222",      // For landlines
    defaultCountryCode: "+(506)"  // Costa Rica
  })
});
```

**Input → Output Examples:**

| Input             | Type        | Prefix | Country Code | Output                 |
|-------------------|-------------|--------|--------------|------------------------|
| `"+(506) 1234-5678"` | any        | any    | any          | `"+(506) 1234-5678"` (unchanged) |
| `"1234"`          | work_phone  | "2222" | "+(506)"     | `"+(506) 2222-1234"`   |
| `"1234"`          | mobile_phone| "2222" | "+(506)"     | `"1234"` (no prefix for mobile) |
| `"88889999"`      | any         | -      | "+(506)"     | `"+(506) 8888-9999"`   |
| `"8888-9999"`     | any         | -      | "+(506)"     | `"+(506) 8888-9999"`   |
| `"999"`           | work_phone  | any    | any          | `"999"` (extension)    |
| `"999999"`        | any         | any    | any          | `"999999"` (6 digits, unknown) |

### Implementation Details

**Files Modified:**

1. **Schema & Migration:**
   - `api-server/prisma/schema.prisma` - Added fields to Project model
   - `api-server/prisma/migrations/20251127_add_project_phone_config/migration.sql`

2. **TypeScript/Node.js:**
   - `api-server/src/features/batch-upload/types.ts` - Updated `BatchProcessingJob`
   - `api-server/src/features/batch-upload/services/batchUploadService.ts` - Fetch project config
   - `api-server/src/features/batch-parsing/services/batchParsingService.ts` - Pass to Python
   - `api-server/src/features/batch-parsing/services/workerService.ts` - Extract from job
   - `api-server/src/server.ts` - Added automatic database initialization
   - `api-server/src/core/database/init.ts` - Automatic migration deployment

3. **Python Parser:**
   - `api-server/batch-parsing/parser.py` - Accept CLI arguments, pass to normalizer
   - `api-server/batch-parsing/data_normalizer.py` - Complete phone logic rewrite

4. **Frontend UI:**
   - `front-cards/features/simple-projects/types/index.ts` - Added UpdateProjectRequest type
   - `front-cards/features/simple-projects/services/projectService.ts` - updateProject method
   - `front-cards/features/simple-projects/hooks/useProjects.ts` - updateProject hook
   - `front-cards/features/simple-projects/components/ProjectSettings.tsx` - Phone settings UI
   - `front-cards/app/dashboard/page.tsx` - Integrated ProjectSettings component

### Testing

**Test Scenarios:**
1. ✅ International numbers preserved: `"+(506) 1234-5678"`
2. ⏳ 4-digit work phones with prefix: `"1234"` → `"+(506) 2222-1234"`
3. ⏳ 8-digit numbers with country code: `"88889999"` → `"+(506) 8888-9999"`
4. ⏳ Extensions not modified: `"999"` → `"999"`
5. ⏳ Unknown countries unchanged: `"999999"` → `"999999"`
6. ⏳ Mobile phones don't get work prefix

**To Test:**
Upload a CSV with various phone formats and verify correct formatting.

---

## 11. Testing & Debugging

### How to Test File Upload

**1. Start all services:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**2. Check services are healthy:**
```bash
docker ps
# All should show "healthy" status
```

**3. Upload via curl:**
```bash
curl -X POST http://localhost:7400/api/batches/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-contacts.csv" \
  -F "projectId=00000000-0000-0000-0000-000000000000" \
  -F "projectName=Test Project"
```

**4. Upload via frontend:**
- Navigate to http://localhost:7300/upload
- Drag file or click to select
- Click "Upload File"
- Watch status tracker

### How to Check Queue Status

**Via API:**
```bash
curl http://localhost:7400/api/diagnostics/queue-stats
```

**Via Redis CLI:**
```bash
# Check queue length
docker exec -it redis redis-cli LLEN batch-parse-queue

# View jobs
docker exec -it redis redis-cli LRANGE batch-parse-queue 0 -1

# Check failed jobs
docker exec -it redis redis-cli ZRANGE bull:batch-parse-queue:failed 0 -1 WITHSCORES
```

### How to Verify Database Records

**PostgreSQL:**
```bash
# Connect to database
docker exec -it postgres psql -U ecards_user -d ecards_db

# Check batches
SELECT id, file_name, status, records_count, records_processed
FROM batches
ORDER BY created_at DESC
LIMIT 5;

# Check batch records
SELECT id, batch_id, full_name, email, business_name
FROM batch_records
ORDER BY created_at DESC
LIMIT 10;
```

**Cassandra:**
```bash
# Connect to Cassandra
docker exec -it cassandra cqlsh

# Use keyspace
USE ecards;

# Check record count
SELECT COUNT(*) FROM contact_records;

# View records
SELECT batch_record_id, full_name, email, work_phone, business_name
FROM contact_records
LIMIT 10;

# Get specific record (from PostgreSQL search)
SELECT * FROM contact_records
WHERE batch_record_id = 'uuid-from-postgres';
```

### Debugging Commands and Scripts

**Check API server logs:**
```bash
docker logs api-server -f
```

**Check worker processing:**
```bash
docker logs api-server -f | grep -E "(Job|Parser|Processing)"
```

**Check Python parser logs:**
```bash
docker logs api-server -f | grep -E "(parser.py|ERROR|WARNING)"
```

**Test Python parser manually:**
```bash
# Enter container
docker exec -it api-server bash

# Run parser directly
cd batch-parsing
python3 parser.py \
  --batch-id "BATCH_UUID" \
  --file-path "batches/user@email.com/project-id/file.csv" \
  --postgres-url "$DATABASE_URL" \
  --cassandra-hosts "cassandra" \
  --storage-mode "seaweedfs" \
  --verbose
```

**Check file in SeaweedFS:**
```bash
# List files
curl http://localhost:8333/files/batches/

# Download file
curl http://localhost:8333/files/batches/user@email.com/project-id/file.csv
```

**Full diagnostic script:**
```bash
#!/bin/bash
# check-batch-parsing.sh

echo "=== Services Status ==="
docker ps | grep -E "(postgres|cassandra|redis|api-server)"

echo -e "\n=== Queue Stats ==="
curl -s http://localhost:7400/api/diagnostics/queue-stats | jq

echo -e "\n=== Redis Status ==="
curl -s http://localhost:7400/api/diagnostics/redis-status | jq

echo -e "\n=== Recent Batches ==="
docker exec -it postgres psql -U ecards_user -d ecards_db \
  -c "SELECT id, file_name, status, records_count, records_processed, error_message FROM batches ORDER BY created_at DESC LIMIT 3;"

echo -e "\n=== API Server Logs (last 20 lines) ==="
docker logs api-server --tail 20
```

---

## 12. Next Steps

### Immediate (In Development)

1. **Phone Number Prefix Configuration**
   - Design configuration approach (project vs batch level)
   - Add database schema fields
   - Update upload form to accept optional prefixes
   - Implement prefix logic in Python parser
   - Preserve E.164 formatted numbers

2. **Testing Phone Prefix Feature**
   - Test with short numbers (< 8 digits)
   - Test with existing E.164 numbers
   - Test with missing country codes
   - Verify project-specific settings work

### Short-term (Enhancements)

4. **Performance Testing**
   - Test with large files (1k, 10k, 100k rows)
   - Measure parsing time
   - Identify bottlenecks
   - Optimize if needed

5. **Error Recovery**
   - Implement retry logic for failed records
   - Add partial success handling
   - Store failed records for review

6. **User Feedback**
   - Real-time progress updates via WebSocket
   - Detailed error messages to frontend
   - Parsing preview (first 10 rows)

### Medium-term (Features)

7. **Batch Management**
   - Edit parsed records
   - Delete batches
   - Re-parse failed batches
   - Export to CSV

8. **Advanced Search**
   - Full-text search
   - Fuzzy matching
   - Multiple field filters
   - Saved searches

9. **Duplicate Detection**
   - Email-based deduplication
   - Phone-based deduplication
   - Merge suggestions

### Long-term (Optimization)

10. **Scalability**
    - Horizontal worker scaling
    - Cassandra cluster setup
    - Redis cluster/sentinel
    - CDN for file downloads

11. **Analytics**
    - Batch statistics dashboard
    - Data quality metrics
    - Usage analytics
    - Export reports

12. **Integration**
    - API for external systems
    - Webhook notifications
    - Bulk import/export
    - Template-based card generation

---

## 13. Troubleshooting Reference

### Issue: File Not Parsing

**Symptoms:**
- Status stuck on UPLOADED
- No logs from parser
- Queue shows waiting jobs

**Check:**
1. Redis running: `docker ps | grep redis`
2. Worker started: Look for "Batch parsing worker started" in logs
3. Queue stats: `curl http://localhost:7400/api/diagnostics/queue-stats`
4. Python installed: `docker exec api-server python3 --version`

**Fix:**
```bash
# Restart services
docker-compose restart redis api-server

# Re-enqueue job (if endpoint exists)
curl -X POST http://localhost:7400/api/batches/{batch-id}/retry
```

### Issue: Parser Crashes

**Symptoms:**
- Status changes to ERROR
- Python error in logs
- Job marked as failed

**Check:**
1. Python logs: `docker logs api-server | grep -A 20 "ERROR"`
2. File format: Ensure CSV/Excel/TXT is valid
3. Database connections: Check PostgreSQL and Cassandra are reachable

**Fix:**
- Check specific error message
- Validate file format
- Test parser manually (see section 10)

### Issue: Records Not Searchable

**Symptoms:**
- Status shows PARSED
- Search returns no results
- PostgreSQL has no batch_records

**Check:**
1. PostgreSQL records: `SELECT COUNT(*) FROM batch_records WHERE batch_id = 'uuid'`
2. Cassandra records: `SELECT COUNT(*) FROM contact_records`
3. Parser logs: Look for INSERT statements

**Fix:**
- Re-run parsing
- Check database permissions
- Verify field mappings

### Issue: Cassandra Connection Failed

**Symptoms:**
- Parser error: "Cannot connect to Cassandra"
- Timeout errors

**Check:**
1. Cassandra running: `docker ps | grep cassandra`
2. Keyspace exists: `docker exec cassandra cqlsh -e "DESCRIBE KEYSPACE ecards"`
3. Network connectivity: `docker exec api-server ping cassandra`

**Fix:**
```bash
# Restart Cassandra
docker-compose restart cassandra

# Wait for healthy status
docker ps | grep cassandra

# Reinitialize schema if needed
docker exec -i cassandra cqlsh < api-server/cassandra.obsolete/init-schemas.cql
```

---

## 14. Related Documentation

**Implementation Guides:**
- `/BATCH-PARSING-IMPLEMENTATION.md` - Complete implementation details
- `/BATCH-PARSING-TROUBLESHOOTING.md` - Step-by-step debugging guide

**Code Documentation:**
- `front-cards/features/batch-upload/README.md` - Frontend feature docs
- `api-server/src/features/batch-upload/README.md` - Upload service docs
- `api-server/batch-parsing/README.md` - Python parser docs

**Architecture:**
- `/ARCHITECTURE.md` - System-wide architecture
- `/DOCS_CONTEXT.md` - Project conventions
- `/DOCS_TECH_STACK.md` - Technology stack

**Database:**
- `api-server/prisma/schema.prisma` - PostgreSQL schema
- `api-server/cassandra.obsolete/init-schemas.cql` - Cassandra schema

---

## 15. Quick Reference Commands

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker logs api-server -f

# Check queue
curl http://localhost:7400/api/diagnostics/queue-stats | jq

# PostgreSQL shell
docker exec -it postgres psql -U ecards_user -d ecards_db

# Cassandra shell
docker exec -it cassandra cqlsh

# Redis CLI
docker exec -it redis redis-cli

# Restart worker
docker-compose restart api-server

# Full reset (dangerous!)
docker-compose down -v  # Deletes all data!
docker-compose up -d
```

---

**End of Feature Context Document**

For feature-worker agent: This document contains all context needed to resume work on batch-upload and batch-parsing features. Priority is debugging the string formatting error and verifying Cassandra inserts.
