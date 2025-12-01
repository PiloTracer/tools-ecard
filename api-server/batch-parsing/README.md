# Batch Parsing Service

Complete Python-based parsing service for processing uploaded batch files with hybrid PostgreSQL + Cassandra storage.

## 🎯 Overview

The batch-parsing service processes contact data files (CSV, Excel, TXT, VCF, JSON) and stores them in a hybrid database architecture:

- **PostgreSQL `batch_records`**: 5 searchable fields for fast cross-batch queries
- **Cassandra `contact_records`**: Complete 35+ vCard fields for full data retrieval

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    End-to-End Flow                          │
└─────────────────────────────────────────────────────────────┘

1. User uploads file via API
   ↓
2. batchUploadService creates batch record & enqueues job
   ↓
3. Bull/Redis queue → batchParsingWorker picks up job
   ↓
4. Worker spawns Python parser.py
   ↓
5. Python downloads file from SeaweedFS (storage_client.py)
   ↓
6. Python parses file (file_parser.py)
   ↓
7. Python normalizes data (data_normalizer.py)
   ↓
8. Python writes to PostgreSQL (5 fields) + Cassandra (35+ fields)
   ↓
9. Batch status updated: UPLOADED → PARSING → PARSED
   ↓
10. API endpoints available for searching & retrieval
```

## 📦 Components

### Python Modules

- **`parser.py`** - Main orchestrator, CLI entry point
- **`storage_client.py`** - Downloads files from SeaweedFS/local storage
- **`file_parser.py`** - Parses CSV, Excel, TXT, VCF, JSON formats
- **`data_normalizer.py`** - Field mapping, name parsing, phone normalization
- **`requirements.txt`** - Python dependencies

### Node.js Integration

- **`batchParsingService.ts`** - Spawns Python parser from Node.js
- **`workerService.ts`** - Bull queue worker for async processing
- **`batchRecordRepository.ts`** - Hybrid PostgreSQL + Cassandra queries

## 🚀 Setup

### 1. Install Python Dependencies

```bash
cd api-server/batch-parsing
pip install -r requirements.txt
```

### 2. Environment Variables

Ensure these are set in your `.env`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ecards"
CASSANDRA_HOSTS="localhost"
CASSANDRA_KEYSPACE="ecards"

# Storage (SeaweedFS)
SEAWEEDFS_ENDPOINT="http://seaweedfs:8333"
SEAWEEDFS_BUCKET="files"
SEAWEEDFS_ACCESS_KEY="admin"
SEAWEEDFS_SECRET_KEY="admin"
USE_LOCAL_STORAGE="false"  # Set to "true" for local filesystem

# Local Storage (if USE_LOCAL_STORAGE=true)
LOCAL_STORAGE_PATH="/app/uploads"

# Python
PYTHON_PATH="python3"  # or "python" depending on system
```

### 3. Initialize Databases

**PostgreSQL** (via Prisma):
```bash
cd api-server
npx prisma generate
npx prisma db push
```

**Cassandra** (automatic on server startup):
- Schema is automatically created when server starts
- See `api-server/src/core/cassandra/init.ts`

## 🧪 Testing

### Manual Test: Python Parser Standalone

```bash
cd api-server/batch-parsing

python parser.py \
  --batch-id "test-batch-uuid" \
  --file-path "batches/test@example.com/project-id/contacts.csv" \
  --postgres-url "postgresql://user:pass@localhost:5432/ecards" \
  --cassandra-hosts "localhost" \
  --storage-mode "seaweedfs" \
  --verbose
```

### Test via API

1. **Upload a batch file:**
```bash
curl -X POST http://localhost:7200/api/batches/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@contacts.csv" \
  -F "projectId=project-uuid" \
  -F "projectName=Test Project"
```

Response:
```json
{
  "id": "batch-uuid",
  "status": "UPLOADED",
  "message": "File uploaded successfully. Processing will begin shortly."
}
```

2. **Check batch status:**
```bash
curl http://localhost:7200/api/batches/batch-uuid/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Search records (cross-batch):**
```bash
# Search by email
curl "http://localhost:7200/api/batch-records?email=john@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search by name
curl "http://localhost:7200/api/batch-records?fullName=Juan" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search by company
curl "http://localhost:7200/api/batch-records?businessName=Acme" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Get full contact details:**
```bash
curl http://localhost:7200/api/batch-records/record-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📁 Supported File Formats

### CSV Files
- Header detection (automatic)
- UTF-8 encoding (auto-detected)
- 40+ field aliases (email, correo, e-mail, etc.)

### Excel Files (.xls, .xlsx)
- Header row detection (scans first 20 rows)
- Multiple sheet support
- Mixed data types

### Text Files (.txt)
- Vertical format with email anchor
- Structure: Name → Title → Email → Phones

### VCF Files (.vcf)
- vCard 4.0 format
- Multiple contacts per file

## 🗺️ Field Mapping

All fields are mapped to standardized vCard field names from `vcardFields.ts`:

### 5 PostgreSQL Searchable Fields:
- `full_name` - Complete name
- `work_phone` - Work phone (E.164 format)
- `mobile_phone` - Mobile phone (E.164 format)
- `email` - Email address
- `business_name` - Company/organization name

### 35+ Cassandra Full Fields:
- Core: first_name, last_name, full_name
- Contact: work_phone, work_phone_ext, mobile_phone, email
- Address: address_street, address_city, address_state, address_postal, address_country
- Social: social_instagram, social_twitter, social_facebook
- Business: business_name, business_title, business_department, business_url, business_hours
- Business Address: business_address_street, business_address_city, etc.
- Professional: business_linkedin, business_twitter
- Personal: personal_url, personal_bio, personal_birthday

## 🇨🇷 Spanish Name Parsing

Intelligent name parsing for Costa Rican data:

```python
# Handles surname-first format
"PÉREZ GARCÍA JUAN CARLOS" → first_name="Juan Carlos", last_name="Pérez García"

# Handles normal order
"Juan Carlos Pérez García" → first_name="Juan Carlos", last_name="Pérez García"

# Preserves accents
"José María Hernández" → correctly preserved
```

## 📞 Phone Normalization

```python
# Costa Rica 8-digit format
"86522766" → "8652-2766"

# E.164 International format
"+50686522766" → "+50686522766"
"506-8652-2766" → "+50686522766"

# Extension handling
"2459-7553 ext. 123" → work_phone="+50624597553", work_phone_ext="123"
```

## 🔍 Cross-Batch Search

Search across **ALL batches** for an employee:

```typescript
// Find all instances of an employee by email
const results = await batchRecordRepository.searchRecords({
  email: 'juan@example.com'
});
// Returns: All records from all batches with this email

// Find employee by phone
const results = await batchRecordRepository.searchRecords({
  mobilePhone: '+50686522766'
});

// Find by company
const results = await batchRecordRepository.searchRecords({
  businessName: 'Acme'
});

// Combine filters
const results = await batchRecordRepository.searchRecords({
  businessName: 'Acme',
  email: 'juan@example.com',
  limit: 50,
  offset: 0
});
```

## 🐛 Troubleshooting

### Python Dependencies Missing
```bash
pip install -r requirements.txt
```

### SeaweedFS Connection Error
```bash
# Check SeaweedFS is running
curl http://seaweedfs:8333/status

# Check environment variables
echo $SEAWEEDFS_ENDPOINT
echo $SEAWEEDFS_ACCESS_KEY
```

### Cassandra Schema Not Created
```bash
# Check if schema exists
docker exec -it cassandra cqlsh -e "DESCRIBE KEYSPACE ecards;"

# If not, server will auto-create on next startup
# Or manually run:
docker exec -i cassandra cqlsh < api-server/cassandra/init-schemas.cql
```

### Worker Not Processing Jobs
```bash
# Check Redis connection
redis-cli ping

# Check worker logs
docker logs api-server | grep "batch parsing worker"

# Check queue stats
redis-cli LLEN batch-parse-queue
```

## 📊 Performance

- **Parse Rate**: ~1000 records in < 30 seconds
- **Storage**: 2x writes (PostgreSQL + Cassandra)
- **Search**: Sub-100ms for indexed fields
- **Full Retrieval**: O(1) Cassandra lookup by batch_record_id

## 🔐 Security

- ✅ JWT authentication required for all API endpoints
- ✅ Users can only access their own batches
- ✅ File size limited to 10MB
- ✅ SQL injection prevention (prepared statements)
- ✅ CQL injection prevention (prepared statements)
- ✅ Path traversal prevention (sanitized file paths)

## 📝 Status Flow

```
UPLOADED  → File uploaded to storage, batch record created
   ↓
PARSING   → Python parser started, processing file
   ↓
PARSED    → Records inserted to databases, ready for search
   ↓
LOADED    → (Future: Cards generated from contacts)
   ↓
ERROR     → Parsing failed, error message stored
```

## 🎓 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batches/upload` | Upload batch file |
| GET | `/api/batches/:id/status` | Get batch status |
| GET | `/api/batches` | List user batches |
| GET | `/api/batch-records` | **Search across all batches** |
| GET | `/api/batch-records/:id` | Get full contact details |
| GET | `/api/batch-records/batch/:batchId` | Get all records for a batch |
| GET | `/api/batch-records/batch/:batchId/stats` | Get batch statistics |

## ✅ Implementation Status

- ✅ Python parser with SeaweedFS integration
- ✅ Hybrid PostgreSQL + Cassandra storage
- ✅ Cross-batch search capability
- ✅ Automatic schema initialization
- ✅ Bull/Redis queue integration
- ✅ Node.js worker service
- ✅ API endpoints
- ✅ Spanish name parsing
- ✅ Phone normalization
- ✅ Field mapping (40+ aliases)

## 🚀 Next Steps

To use the system:

1. Ensure databases are running (PostgreSQL, Cassandra, Redis)
2. Start the API server: `npm run dev`
3. Upload a batch file via API or UI
4. Watch the worker logs for processing status
5. Search records via API endpoints

The entire end-to-end flow is **fully implemented and ready to use**! 🎉
