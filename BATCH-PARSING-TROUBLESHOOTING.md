# Batch Parsing Troubleshooting Guide

## 🔍 Issue: File Uploaded But Not Parsed

If your file appears in SeaweedFS and the `batches` table in PostgreSQL but parsing doesn't continue, follow these steps:

## Step 1: Check if Redis is Running

```bash
# Test Redis connection
redis-cli ping
# Expected output: PONG

# Or via Docker
docker ps | grep redis
```

**If Redis is NOT running:**
```bash
# Start Redis via Docker Compose
docker-compose up -d redis

# Or start Redis standalone
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

## Step 2: Check Queue Statistics

**Call the diagnostic endpoint:**
```bash
curl http://localhost:7200/api/diagnostics/queue-stats
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "queue": {
      "waiting": 1,     // Jobs waiting to be processed
      "active": 0,      // Jobs currently processing
      "completed": 0,   // Successfully completed jobs
      "failed": 0,      // Failed jobs
      "delayed": 0      // Delayed jobs
    },
    "worker": {
      "isProcessing": true,  // Worker is running
      "queueStats": { ... }
    }
  }
}
```

**What to look for:**
- ✅ `worker.isProcessing: true` - Worker is running
- ✅ `queue.waiting > 0` - Jobs are queued
- ❌ `worker.isProcessing: false` - **Worker NOT started**
- ❌ `queue.waiting == 0` - **No jobs queued**

## Step 3: Check Redis Connection

```bash
curl http://localhost:7200/api/diagnostics/redis-status
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "host": "redis",
    "port": 6379
  }
}
```

**If connection fails:**
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`
- Ensure Redis is accessible from api-server container

## Step 4: Check Server Logs

Look for these log messages when server starts:

```
✅ Connected to PostgreSQL
🔍 Checking Cassandra schema...
✅ Cassandra schema initialized
🔧 Starting batch parsing worker...
🔌 Connecting to Redis: redis:6379
✅ Redis queue initialized
📋 Setting up job processor...
✅ Batch parsing job processor setup complete
✅ Batch parsing worker started successfully
🚀 API Server running on http://localhost:7200
```

**Missing logs indicate:**
- No "Starting batch parsing worker" = Worker not initialized
- No "Redis queue initialized" = Redis connection failed
- Errors about Bull/Redis = Redis configuration issue

## Step 5: Verify Environment Variables

Check your `.env` file has:

```bash
# Redis (required for queue)
REDIS_HOST=redis
REDIS_PORT=6379
# REDIS_PASSWORD=  # Optional

# PostgreSQL (required)
DATABASE_URL=postgresql://user:password@postgres:5432/ecards

# Cassandra (required)
CASSANDRA_HOSTS=cassandra
CASSANDRA_KEYSPACE=ecards

# SeaweedFS (required for file download)
SEAWEEDFS_ENDPOINT=http://seaweedfs:8333
SEAWEEDFS_BUCKET=files
SEAWEEDFS_ACCESS_KEY=admin
SEAWEEDFS_SECRET_KEY=admin

# Storage mode
USE_LOCAL_STORAGE=false

# Python
PYTHON_PATH=python3
```

## Step 6: Manual Queue Check (Redis CLI)

```bash
# Check if jobs are in queue
redis-cli LLEN batch-parse-queue
# Expected: Number > 0 if jobs are queued

# View job IDs
redis-cli LRANGE batch-parse-queue 0 -1

# Check job details
redis-cli HGETALL bull:batch-parse-queue:JOB_ID
```

## Step 7: Force Re-enqueue Failed Batch

If a batch is stuck in UPLOADED status:

```bash
curl -X POST http://localhost:7200/api/batches/{batch-id}/retry \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This will:
1. Reset batch status to UPLOADED
2. Re-enqueue the job
3. Worker will pick it up

## Step 8: Check Python Environment

```bash
# Enter api-server container
docker exec -it api-server bash

# Check Python is installed
python3 --version

# Check Python dependencies
cd batch-parsing
pip list | grep -E "pandas|boto3|cassandra|psycopg2"
```

**If dependencies missing:**
```bash
cd batch-parsing
pip install -r requirements.txt
```

## Step 9: Test Python Parser Manually

```bash
# Inside api-server container
cd batch-parsing

python3 parser.py \
  --batch-id "BATCH_UUID_FROM_DATABASE" \
  --file-path "batches/email@example.com/project-id/filename.csv" \
  --postgres-url "$DATABASE_URL" \
  --cassandra-hosts "cassandra" \
  --storage-mode "seaweedfs" \
  --verbose
```

**Watch for errors:**
- SeaweedFS connection failures
- Database connection errors
- File parsing errors
- Python import errors

## Step 10: Check Batch Status in Database

```sql
-- Check batch status
SELECT id, file_name, status, error_message, created_at, updated_at
FROM batches
ORDER BY created_at DESC
LIMIT 5;

-- Check if parsing was attempted
SELECT id, file_name, status, parsing_started_at, parsing_completed_at, error_message
FROM batches
WHERE status != 'UPLOADED'
ORDER BY created_at DESC;
```

## Common Issues and Solutions

### Issue 1: Redis Not Connected
**Symptoms:** Worker shows `isProcessing: false`, no jobs processing

**Solution:**
```bash
# Check Redis
docker ps | grep redis

# Restart Redis
docker-compose restart redis

# Restart api-server
docker-compose restart api-server
```

### Issue 2: Worker Not Started
**Symptoms:** Logs don't show "Batch parsing worker started"

**Solution:**
1. Check `server.ts` has `await batchParsingWorker.start();`
2. Restart api-server: `docker-compose restart api-server`
3. Check logs: `docker logs api-server -f`

### Issue 3: Jobs Not Being Queued
**Symptoms:** `queue.waiting == 0` after upload

**Solution:**
1. Check `batchUploadService.ts` calls `queueService.enqueueBatchParsing()`
2. Check for errors in upload logs
3. Verify Redis connection in QueueService

### Issue 4: Python Not Found
**Symptoms:** "python3: command not found" in logs

**Solution:**
```bash
# Install Python in container
docker exec -it api-server bash
apt-get update && apt-get install -y python3 python3-pip

# Or rebuild container with Python
docker-compose build api-server
```

### Issue 5: SeaweedFS Download Fails
**Symptoms:** Python parser errors "Failed to download from SeaweedFS"

**Solution:**
1. Check SeaweedFS is running: `curl http://seaweedfs:8333/status`
2. Verify credentials in environment variables
3. Check file exists: Look in SeaweedFS UI or API
4. Test download manually:
   ```bash
   aws s3 ls s3://files/batches/ \
     --endpoint-url http://seaweedfs:8333 \
     --no-verify-ssl
   ```

### Issue 6: Cassandra Schema Missing
**Symptoms:** Python error "Keyspace 'ecards' does not exist"

**Solution:**
```bash
# Check schema
docker exec -it cassandra cqlsh -e "DESCRIBE KEYSPACE ecards;"

# Create manually if needed
docker exec -i cassandra cqlsh < api-server/cassandra/init-schemas.cql

# Or restart server (auto-creates)
docker-compose restart api-server
```

## Quick Diagnostic Commands

```bash
# 1. Check all services are running
docker ps

# 2. Check queue stats
curl http://localhost:7200/api/diagnostics/queue-stats

# 3. Check Redis
redis-cli ping

# 4. Check server logs (last 50 lines)
docker logs api-server --tail 50

# 5. Check batch status in database
docker exec -it postgres psql -U ecards -d ecards \
  -c "SELECT id, file_name, status, error_message FROM batches ORDER BY created_at DESC LIMIT 3;"

# 6. Check Redis queue length
redis-cli LLEN batch-parse-queue

# 7. View failed jobs
redis-cli ZRANGE bull:batch-parse-queue:failed 0 -1 WITHSCORES
```

## Success Indicators

When everything is working, you should see:

1. **Upload response:**
   ```json
   {
     "id": "batch-uuid",
     "status": "UPLOADED",
     "message": "File uploaded successfully. Processing will begin shortly."
   }
   ```

2. **Server logs:**
   ```
   Batch parsing job queued: 1
   🔄 Job 1 started processing
   🐍 Spawning Python parser for batch uuid...
   📥 Downloading file from storage: batches/...
   ✅ Downloaded to: /tmp/...
   📄 Parsing file: /tmp/...
   📊 Found 50 rows to process
   ✅ Successfully processed 50/50 records
   ✅ Job 1 completed successfully
   ```

3. **Database status progression:**
   ```
   UPLOADED → PARSING → PARSED
   ```

4. **Queue stats:**
   ```json
   {
     "worker": { "isProcessing": true },
     "queue": { "completed": 1, "waiting": 0, "failed": 0 }
   }
   ```

## Still Not Working?

If you've tried all the above and it's still not working:

1. **Collect diagnostic info:**
   ```bash
   # Save logs
   docker logs api-server > api-server.log 2>&1

   # Save queue stats
   curl http://localhost:7200/api/diagnostics/queue-stats > queue-stats.json

   # Save batch info
   docker exec postgres psql -U ecards -d ecards \
     -c "SELECT * FROM batches ORDER BY created_at DESC LIMIT 5;" > batches.txt
   ```

2. **Check these files and share with support:**
   - api-server.log
   - queue-stats.json
   - batches.txt
   - docker-compose.yml
   - .env (without sensitive values)

## Need Help?

Create an issue with:
- Symptoms observed
- Diagnostic output from above commands
- Error messages from logs
- Environment (Docker, local, etc.)
