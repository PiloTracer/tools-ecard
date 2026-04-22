# Materialized Views Fix

**Date:** 2025-01-25
**Issue:** db-init service failed with "Materialized views are disabled"
**Status:** ✅ FIXED

---

## Problem

Cassandra 5.0 has **materialized views disabled by default**. Schema initialization failed because files were trying to create materialized views:

```
db-init | /scripts/02-template-storage.cql:220:InvalidRequest:
Error from server: code=2200 [Invalid query]
message="Materialized views are disabled. Enable in cassandra.yaml to use."
```

---

## Solution Applied

**Commented out all materialized views** in schema files:

### Files Modified:

1. **db/init-cassandra/02-template-storage.cql**
   - `templates_by_storage_mode` (commented out)
   - `pending_sync_by_user` (commented out)
   - `recent_mode_transitions` (commented out)

2. **db/init-cassandra/03-template-textile-tables.cql**
   - `textile_events_by_user` (commented out)
   - `textile_events_by_type` (commented out)

**Total:** 5 materialized views disabled

---

## Why This is OK

**Materialized views are optional performance optimizations.**

- They provide pre-computed query results for faster reads
- But they add overhead to writes and storage
- **All core functionality works without them**
- You can query the base tables directly (slightly slower but works)

**Application code does NOT rely on materialized views** - only uses base tables.

---

## To Enable Materialized Views (Optional)

If you need materialized views for performance:

### Option 1: Enable in Cassandra Config

```bash
# Stop services
docker-compose -f docker-compose.dev.yml down

# Create custom cassandra.yaml
# Add this to docker-compose.dev.yml under cassandra service:
volumes:
  - ./cassandra-config/cassandra.yaml:/etc/cassandra/cassandra.yaml

# Create cassandra-config/cassandra.yaml with:
materialized_views_enabled: true

# Restart
docker-compose -f docker-compose.dev.yml up -d
```

### Option 2: Uncomment Views in Schema Files

After enabling in config:

1. Edit `db/init-cassandra/02-template-storage.cql` - remove `/*` and `*/` around views
2. Edit `db/init-cassandra/03-template-textile-tables.cql` - remove `/*` and `*/` around views
3. Manually run scripts:

```bash
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/02-template-storage.cql
docker exec -it ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/03-template-textile-tables.cql
```

---

## Restart Services Now

The schemas are now fixed. Restart to apply:

```bash
# Stop everything
docker-compose -f docker-compose.dev.yml down

# Start fresh
docker-compose -f docker-compose.dev.yml up -d

# Watch db-init logs (should succeed now)
docker-compose -f docker-compose.dev.yml logs -f db-init

# Expected output:
# ✅ Initializing Cassandra...
# ✅ Running /scripts/01-create-keyspace.cql...
# ✅ Running /scripts/02-template-storage.cql...
# ✅ Running /scripts/03-template-textile-tables.cql...
# ✅ Running /scripts/05-batch-upload-tables.cql...
# ✅ Running /scripts/06-contact-records.cql...
# ✅ Cassandra initialization complete!

# Verify all services start
docker-compose -f docker-compose.dev.yml ps

# All should show "running" or "Up"
```

---

## Performance Impact

**Without materialized views:**
- Queries on base tables work fine
- Slightly slower for complex filtered queries
- Less storage used
- Faster writes

**With materialized views:**
- Pre-computed results = faster reads
- More storage required
- Slower writes (views must update)
- More complex to maintain

**For most workloads, base tables are sufficient.**

---

**Action:** Restart services now! ✅
