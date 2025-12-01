# Cassandra Schema Migration Notes

**Date:** 2025-01-25
**Version:** Consolidated Schema v3.0

## Overview

The Cassandra schemas have been consolidated from multiple locations into a single source of truth in `db/init-cassandra/`. This document outlines any manual actions required if you have existing data.

---

## Schema Consolidation Summary

### What Changed

1. **Merged Files**: Old `02-template-configs.cql` and `04-template-multimode-tables.cql` have been merged into new `02-template-storage.cql`
2. **Removed DROP Statements**: All `DROP TABLE` and `DROP MATERIALIZED VIEW` statements removed
3. **Added Contact Records**: New `06-contact-records.cql` for batch parsing feature
4. **Keyspace Standardization**: All schemas now use `ecards_canonical` keyspace consistently

### File Structure

```
db/init-cassandra/
├── 01-create-keyspace.cql          (unchanged)
├── 02-template-storage.cql         (NEW - consolidated)
├── 02-template-configs.cql.bak     (backup of old file)
├── 03-template-textile-tables.cql  (unchanged)
├── 04-template-multimode-tables.cql.bak (backup of old file)
├── 05-batch-upload-tables.cql      (unchanged)
└── 06-contact-records.cql          (NEW)
```

---

## ⚠️ REQUIRED MANUAL ACTIONS

### If You Have Existing `template_events` Table

The `template_events` table schema has **INCOMPATIBLE CHANGES** between old and new versions.

**Old Schema** (from 02-template-configs.cql):
```sql
PRIMARY KEY (template_id, event_timestamp)
-- Columns: template_id, event_timestamp, event_type, user_id, project_id, event_data
```

**New Schema** (from 02-template-storage.cql):
```sql
PRIMARY KEY ((user_id, template_id), event_id)
-- Columns: user_id, template_id, event_id, event_type, storage_mode, event_data,
--          sync_status, ip_address, user_agent, created_at
```

**Action Required:**

```bash
# Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

# Check if old table exists
USE ecards_canonical;
DESCRIBE TABLE template_events;

# If the PRIMARY KEY shows (template_id, event_timestamp), drop it:
DROP TABLE template_events;

# Exit and restart services to recreate with new schema
exit
docker-compose -f docker-compose.dev.yml restart api-server
```

### If You Have Existing Materialized Views

Old materialized views need to be dropped before new ones can be created:

```sql
-- Connect to Cassandra
USE ecards_canonical;

-- Drop old views if they exist with different schemas
DROP MATERIALIZED VIEW IF EXISTS templates_by_storage_mode;
DROP MATERIALIZED VIEW IF EXISTS pending_sync_by_user;
DROP MATERIALIZED VIEW IF EXISTS recent_mode_transitions;

-- Restart services to recreate
```

---

## Tables Currently Used by Code

| Table Name | Used By | Status |
|------------|---------|--------|
| `contact_records` | `batchRecordRepository.ts` | ✅ Active |
| `template_events` | `cassandraClient.ts` | ✅ Active |
| `template_metadata` | `cassandraClient.ts` | ✅ Active |
| `resource_metadata` | `cassandraClient.ts` | ✅ Active |
| `mode_transitions` | `cassandraClient.ts` | ✅ Active |
| `sync_queue` | `cassandraClient.ts` | ✅ Active |
| `storage_health` | `cassandraClient.ts` | ✅ Active |
| `batch_records` | Batch upload feature | ✅ Active |
| `batch_events` | Batch upload feature | ✅ Active |
| `batch_mappings` | Batch upload feature | ✅ Active |
| `textile_template_events` | Future use | 📋 Planned |
| `textile_template_metadata_blob` | Future use | 📋 Planned |
| `template_configs` | Future use | 📋 Planned |
| `resource_events` | Future use | 📋 Planned |
| `template_analytics` | Future use | 📋 Planned |

---

## Clean Install (No Existing Data)

If you're starting fresh or don't have existing data:

```bash
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Remove Cassandra volume (WARNING: DELETES ALL DATA)
docker volume rm tools-ecards_cassandra_data

# Start services (schemas will auto-create)
docker-compose -f docker-compose.dev.yml up -d
```

---

## Verification Steps

After migration, verify all tables exist:

```bash
# Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

# List all tables
USE ecards_canonical;
DESCRIBE TABLES;

# Expected output should include:
# - contact_records
# - template_events (new schema)
# - template_metadata
# - resource_metadata
# - mode_transitions
# - sync_queue
# - storage_health
# - batch_records
# - batch_events
# - batch_mappings
# - template_configs
# - resource_events
# - template_analytics
# - textile_template_events
# - textile_template_metadata_blob

# Verify template_events schema
DESCRIBE TABLE template_events;

# PRIMARY KEY should be: ((user_id, template_id), event_id)
```

---

## Rollback Instructions

If you need to rollback to old schemas:

```bash
# Restore old files
cd db/init-cassandra
mv 02-template-configs.cql.bak 02-template-configs.cql
mv 04-template-multimode-tables.cql.bak 04-template-multimode-tables.cql

# Remove new files
rm 02-template-storage.cql
rm 06-contact-records.cql

# Restart services
docker-compose -f docker-compose.dev.yml restart db-init api-server
```

---

## Questions?

If you encounter issues during migration, check:

1. **Logs**: `docker-compose -f docker-compose.dev.yml logs db-init`
2. **Cassandra Logs**: `docker-compose -f docker-compose.dev.yml logs cassandra`
3. **API Server Logs**: `docker-compose -f docker-compose.dev.yml logs api-server`

---

**End of Migration Notes**
