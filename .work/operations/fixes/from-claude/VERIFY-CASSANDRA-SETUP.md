# Cassandra Setup Verification Guide

**Purpose:** Step-by-step verification that Cassandra schemas are properly initialized

---

## Schema Execution Order

The db-init service will execute these files in order:

```
1. 01-create-keyspace.cql        → Creates ecards_canonical keyspace
2. 02-template-storage.cql       → Creates template & storage tables (10 tables)
3. 03-template-textile-tables.cql → Creates textile tables (2 tables)
4. 05-batch-upload-tables.cql    → Creates batch tables (3 tables)
5. 06-contact-records.cql        → Creates contact_records table (1 table)
```

**Total: 16 tables + materialized views + indexes**

---

## Quick Test (Recommended for Fresh Install)

### Option A: Clean Start (No Data to Preserve)

```bash
# Stop and remove everything
docker-compose -f docker-compose.dev.yml down -v

# Start fresh
docker-compose -f docker-compose.dev.yml up -d

# Watch initialization logs
docker-compose -f docker-compose.dev.yml logs -f db-init

# Expected output:
# ✓ Initializing Cassandra...
# ✓ Running /scripts/01-create-keyspace.cql...
# ✓ Running /scripts/02-template-storage.cql...
# ✓ Running /scripts/03-template-textile-tables.cql...
# ✓ Running /scripts/05-batch-upload-tables.cql...
# ✓ Running /scripts/06-contact-records.cql...
# ✓ Cassandra initialization complete!

# Verify api-server startup
docker-compose -f docker-compose.dev.yml logs -f api-server | grep Cassandra

# Expected output:
# ✓ 🔍 Verifying Cassandra schema...
# ✓ ✅ Connected to Cassandra cluster
# ✓ ✅ Keyspace "ecards_canonical" exists
# ✓ ✅ All critical tables verified
```

### Option B: Migration (Existing Data)

If you have existing Cassandra data:

```bash
# First, check for schema conflicts
docker exec -it ecards-cassandra cqlsh

USE ecards_canonical;
DESCRIBE TABLE template_events;

# If PRIMARY KEY is (template_id, event_timestamp) - OLD SCHEMA, run:
DROP TABLE template_events;
exit

# Restart services
docker-compose -f docker-compose.dev.yml restart db-init api-server

# Verify logs (same as Option A above)
```

---

## Manual Verification

### Step 1: Check Keyspace

```bash
docker exec -it ecards-cassandra cqlsh

DESCRIBE KEYSPACE ecards_canonical;

# Expected output includes:
# CREATE KEYSPACE ecards_canonical WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
```

### Step 2: List All Tables

```sql
USE ecards_canonical;
DESCRIBE TABLES;

# Expected tables (16 total):
# - contact_records          (file 06)
# - template_events          (file 02)
# - template_metadata        (file 02)
# - resource_metadata        (file 02)
# - mode_transitions         (file 02)
# - sync_queue              (file 02)
# - storage_health          (file 02)
# - template_configs        (file 02)
# - resource_events         (file 02)
# - template_analytics      (file 02)
# - textile_template_events (file 03)
# - textile_template_metadata_blob (file 03)
# - batch_records           (file 05)
# - batch_events            (file 05)
# - batch_mappings          (file 05)
# - storage_location        (UDT in file 02)
# - sync_attempt            (UDT in file 02)
```

### Step 3: Verify Critical Table Schemas

```sql
-- Verify template_events has NEW schema
DESCRIBE TABLE template_events;

-- Should show:
-- PRIMARY KEY ((user_id, template_id), event_id)
-- NOT: PRIMARY KEY (template_id, event_timestamp)

-- Verify contact_records exists
DESCRIBE TABLE contact_records;

-- Should show:
-- PRIMARY KEY (batch_record_id)
```

### Step 4: Test Application Connectivity

```bash
# Check api-server can connect
docker-compose -f docker-compose.dev.yml logs api-server | grep -A 5 "Verifying Cassandra"

# Expected:
# ✅ Connected to Cassandra cluster
# ✅ Keyspace "ecards_canonical" exists
# ✅ All critical tables verified
```

---

## Troubleshooting

### Error: "Keyspace not found"

**Symptom:**
```
❌ Keyspace "ecards_canonical" not found!
```

**Solution:**
```bash
# Check db-init logs
docker-compose -f docker-compose.dev.yml logs db-init

# If db-init failed, restart it
docker-compose -f docker-compose.dev.yml restart db-init

# Wait 30 seconds for Cassandra to initialize
# Then restart api-server
docker-compose -f docker-compose.dev.yml restart api-server
```

### Error: "Table not found"

**Symptom:**
```
⚠️  Missing N critical table(s):
   - contact_records
   - template_events
```

**Solution:**
```bash
# Verify CQL files exist
ls db/init-cassandra/*.cql

# Check db-init logs for errors
docker-compose -f docker-compose.dev.yml logs db-init

# Manually run schema (if db-init failed)
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/02-template-storage.cql
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/03-template-textile-tables.cql
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/05-batch-upload-tables.cql
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/06-contact-records.cql
```

### Error: "Template_events schema conflict"

**Symptom:**
```
InvalidRequest: Error from server: code=2200 [Invalid query]
message="Duplicate column name template_id"
```

**Cause:** Old template_events table exists with different schema

**Solution:**
```sql
-- Connect and drop old table
docker exec -it ecards-cassandra cqlsh

USE ecards_canonical;
DROP TABLE IF EXISTS template_events;
DROP MATERIALIZED VIEW IF EXISTS templates_by_storage_mode;

exit

-- Restart to recreate
docker-compose -f docker-compose.dev.yml restart db-init api-server
```

---

## Success Indicators

✅ **db-init logs show:** "Cassandra initialization complete!"
✅ **api-server logs show:** "All critical tables verified"
✅ **No errors** in cassandra container logs
✅ **All 16 tables** appear in `DESCRIBE TABLES`
✅ **Application starts** without schema warnings

---

## Next Steps After Verification

Once verified:

1. **Test batch parsing feature** - ensure contact_records writes work
2. **Test template storage** - ensure template_events logging works
3. **Run integration tests** (if available)
4. **Clean up backups** - delete .bak files after 1 week in production

---

**Ready to test!** Run Option A above to get started.
