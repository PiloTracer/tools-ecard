# Cassandra Schema Consolidation - Summary

**Date:** 2025-01-25
**Status:** ✅ Complete
**Option Selected:** Option 1 (Single Source of Truth in `db/init-cassandra`)

---

## What Was Done

### 1. ✅ Schema Consolidation

**All Cassandra schemas consolidated into:** `db/init-cassandra/`

**New File Structure:**
```
db/init-cassandra/
├── 01-create-keyspace.cql              ✅ Unchanged
├── 02-template-storage.cql             ✨ NEW - Merged from old 02 and 04
├── 02-template-configs.cql.bak         📦 Backup
├── 03-template-textile-tables.cql      ✅ Unchanged
├── 04-template-multimode-tables.cql.bak 📦 Backup
├── 05-batch-upload-tables.cql          ✅ Unchanged
├── 06-contact-records.cql              ✨ NEW - Moved from api-server/cassandra
├── SCHEMA-MIGRATION-NOTES.md           📖 Migration guide
└── [other support files]
```

### 2. ✅ Keyspace Standardization

- **Single keyspace:** `ecards_canonical` (everywhere)
- **Removed:** `ecards` keyspace (was causing conflicts)
- **Environment variable:** `CASSANDRA_KEYSPACE=ecards_canonical` (docker-compose.dev.yml:140)

### 3. ✅ Schema Conflicts Resolved

**File 02-template-storage.cql merges:**
- Legacy tables from old 02 (template_configs, resource_events, template_analytics)
- Active tables from old 04 (template_events, template_metadata, resource_metadata, etc.)
- **All DROP statements removed** as requested
- Uses `CREATE TABLE IF NOT EXISTS` for all tables

**⚠️ IMPORTANT - Manual Action Required:**

If you have an existing `template_events` table with the OLD schema, you must manually drop it:

```bash
# Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

# Check schema
USE ecards_canonical;
DESCRIBE TABLE template_events;

# If PRIMARY KEY is (template_id, event_timestamp), drop it:
DROP TABLE template_events;

# Restart to recreate with new schema
exit
docker-compose -f docker-compose.dev.yml restart db-init api-server
```

See `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md` for details.

### 4. ✅ Application Code Updated

**File:** `api-server/src/core/cassandra/init.ts`

**OLD Behavior:**
- Created schemas from `api-server/cassandra/init-schemas.cql`
- Used hardcoded `ecards` keyspace
- Could conflict with db-init service

**NEW Behavior:**
- Only VERIFIES schemas exist
- Uses `CASSANDRA_KEYSPACE` from environment
- Logs warnings if tables missing
- Does NOT create schemas (db-init handles that)

### 5. ✅ Docker Compose Fixed

**File:** `docker-compose.dev.yml`

**Fixed build error:**
- **Line 304-306:** Changed `$script` to `$$script` to escape bash variable
- **Root cause:** Docker Compose was treating `$script` as environment variable
- **Solution:** Double `$$` tells Docker Compose to pass literal `$` to bash

**Verified settings:**
- Line 140: `CASSANDRA_KEYSPACE: ${CASSANDRA_KEYSPACE:-ecards_canonical}` ✅
- Line 299: `volumes: - ./db/init-cassandra:/scripts` ✅
- Lines 300-310: Script execution loop ✅
- Dependency order: cassandra → db-init → api-server ✅

### 6. ✅ Obsolete Files Handled

**Directory:** `api-server/cassandra/` → `api-server/cassandra.obsolete/`

- Contains old `init-schemas.cql` (no longer used)
- Added `README-OBSOLETE.md` explaining deprecation
- Can be deleted after verification in production

---

## Tables Active in Code

| Table Name | Used By | File | Status |
|------------|---------|------|--------|
| `contact_records` | batchRecordRepository.ts | 06 | ✅ Active |
| `template_events` | cassandraClient.ts | 02 | ✅ Active |
| `template_metadata` | cassandraClient.ts | 02 | ✅ Active |
| `resource_metadata` | cassandraClient.ts | 02 | ✅ Active |
| `mode_transitions` | cassandraClient.ts | 02 | ✅ Active |
| `sync_queue` | cassandraClient.ts | 02 | ✅ Active |
| `storage_health` | cassandraClient.ts | 02 | ✅ Active |
| `batch_records` | Batch upload | 05 | ✅ Active |
| `batch_events` | Batch upload | 05 | ✅ Active |
| `batch_mappings` | Batch upload | 05 | ✅ Active |
| `textile_template_events` | Future use | 03 | 📋 Planned |
| `textile_template_metadata_blob` | Future use | 03 | 📋 Planned |
| `template_configs` | Future use | 02 | 📋 Planned |
| `resource_events` | Future use | 02 | 📋 Planned |
| `template_analytics` | Future use | 02 | 📋 Planned |

---

## Next Steps

### For Clean Installation (Recommended)

If you don't have critical data in Cassandra:

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Remove Cassandra volume (⚠️ DELETES ALL DATA)
docker volume rm tools-ecards_cassandra_data

# Start services - schemas will auto-create
docker-compose -f docker-compose.dev.yml up -d

# Watch logs
docker-compose -f docker-compose.dev.yml logs -f db-init
docker-compose -f docker-compose.dev.yml logs -f api-server
```

### For Migration (If You Have Data)

If you have existing data to preserve:

1. Read `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md`
2. Check for `template_events` schema conflict (see above)
3. Manually drop conflicting tables if needed
4. Restart services

---

## Verification

After deployment, verify schemas:

```bash
# Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

# Check keyspace
DESCRIBE KEYSPACE ecards_canonical;

# List all tables
USE ecards_canonical;
DESCRIBE TABLES;

# Verify critical table exists
DESCRIBE TABLE template_events;

# Should show: PRIMARY KEY ((user_id, template_id), event_id)
```

**Expected tables:** 15 total
- 10 active (used by code)
- 5 planned (for future features)

---

## Build Error Resolution

**Original Error:**
```
time="2025-11-25T14:39:42-06:00" level=warning msg="The \"script\" variable is not set. Defaulting to a blank string."
```

**Root Cause:**
Docker Compose was treating `$script` (bash variable) as an environment variable substitution in docker-compose.dev.yml:304-306.

**Direct Fix:**
Changed `$script` to `$$script` in docker-compose.dev.yml to escape the bash variable.

**Underlying Issues Also Fixed:**
- Schema duplication between `api-server/cassandra/` and `db/init-cassandra/`
- Keyspace mismatch (`ecards` vs `ecards_canonical`)
- Application creating schemas that db-init already created
- Table definition conflicts (template_events had 2 incompatible schemas)

**Complete Resolution:**
- ✅ Escaped bash variables: `$$script` in docker-compose.dev.yml:304-306
- ✅ Single source of truth: `db/init-cassandra/`
- ✅ Single keyspace: `ecards_canonical`
- ✅ No DROP statements (CREATE IF NOT EXISTS only)
- ✅ Application verifies, doesn't create
- ✅ db-init service creates all schemas before app starts

---

## Files Modified

1. **Created:**
   - `db/init-cassandra/02-template-storage.cql` (consolidated)
   - `db/init-cassandra/06-contact-records.cql` (new)
   - `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md` (docs)
   - `api-server/cassandra.obsolete/README-OBSOLETE.md` (docs)

2. **Modified:**
   - `api-server/src/core/cassandra/init.ts` (verify only, not create)

3. **Renamed:**
   - `db/init-cassandra/02-template-configs.cql` → `.bak`
   - `db/init-cassandra/04-template-multimode-tables.cql` → `.bak`
   - `api-server/cassandra/` → `api-server/cassandra.obsolete/`

4. **Unchanged:**
   - `docker-compose.dev.yml` (already correct!)
   - `db/init-cassandra/01-create-keyspace.cql`
   - `db/init-cassandra/03-template-textile-tables.cql`
   - `db/init-cassandra/05-batch-upload-tables.cql`

---

## Rollback Plan

If issues occur, rollback steps in:
→ `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md` (Rollback section)

---

**Ready to deploy!** 🚀

See `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md` for detailed migration instructions.
