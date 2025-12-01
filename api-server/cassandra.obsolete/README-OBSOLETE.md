# OBSOLETE DIRECTORY

**Status:** ❌ No longer used
**Date Deprecated:** 2025-01-25
**Reason:** Schema management consolidated to `db/init-cassandra/`

## What Happened

This directory previously contained `init-schemas.cql` which was used by `api-server/src/core/cassandra/init.ts` to create Cassandra schemas on application startup.

**Problems with old approach:**
1. Schema creation happened in two places (`db/init-cassandra/` and here)
2. Keyspace mismatch (`ecards` vs `ecards_canonical`)
3. Table definition conflicts between locations
4. Application tried to create schemas that db-init already created

## New Approach

**All Cassandra schemas are now managed in:** `db/init-cassandra/`

**Schema files:**
```
db/init-cassandra/
├── 01-create-keyspace.cql          - Creates ecards_canonical keyspace
├── 02-template-storage.cql         - Template tables (merged from old 02 and 04)
├── 03-template-textile-tables.cql  - Textile feature tables
├── 05-batch-upload-tables.cql      - Batch upload tables
└── 06-contact-records.cql          - Contact records (from this directory)
```

**Application behavior changed:**
- `api-server/src/core/cassandra/init.ts` now ONLY verifies schemas exist
- It does NOT create schemas anymore
- db-init service creates all schemas before api-server starts

## Migration

The `contact_records` table from `init-schemas.cql` was moved to:
→ `db/init-cassandra/06-contact-records.cql`

With proper keyspace: `ecards_canonical` (not `ecards`)

## Can This Be Deleted?

**Not yet.** Keep as reference until schema migration is complete and verified in production.

After verification, this directory can be safely removed.

---

**See:** `db/init-cassandra/SCHEMA-MIGRATION-NOTES.md` for complete migration guide
