# Database Setup Guide

**Last Updated:** 2025-01-25

## ✅ Automated Setup (Current)

**Good News!** Database initialization is now **fully automated** via the `db-init` service in docker-compose.

When you run:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

The system automatically:
1. ✅ Starts Cassandra container
2. ✅ Waits for Cassandra to be healthy
3. ✅ Runs all schema scripts from `db/init-cassandra/*.cql`
4. ✅ Creates keyspace `ecards_canonical` and all tables
5. ✅ Allows api-server to start only after schemas are ready

**No manual intervention required!**

## ⚠️ Legacy Issue (Fixed as of 2025-01-25)

**Old error you might have seen:**
```
❌ Failed to connect to Cassandra: ResponseError: Keyspace 'ecards_canonical' does not exist
```

**This has been resolved** - schemas are now auto-created by db-init service before api-server starts.

## Fresh Start (If Needed)

If you need to reset everything:

```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down

# Remove Cassandra volume (deletes all data!)
docker volume rm tools-ecards_cassandra_data

# Start everything fresh (schemas auto-created)
docker-compose -f docker-compose.dev.yml up -d

# Watch initialization
docker-compose -f docker-compose.dev.yml logs -f db-init

# Expected output:
# ✅ Initializing Cassandra...
# ✅ Running /scripts/01-create-keyspace.cql...
# ✅ Running /scripts/02-template-storage.cql...
# ✅ Running /scripts/03-template-textile-tables.cql...
# ✅ Running /scripts/05-batch-upload-tables.cql...
# ✅ Running /scripts/06-contact-records.cql...
# ✅ Cassandra initialization complete!
```

## Verification

Check if the keyspace was created successfully:

```bash
# Connect to Cassandra container
docker exec -it ecards-cassandra cqlsh

# Inside cqlsh, run:
DESCRIBE KEYSPACES;

# You should see 'ecards_canonical' in the list

# To see details:
DESCRIBE KEYSPACE ecards_canonical;

# Exit cqlsh:
EXIT;
```

## Database Architecture

### PostgreSQL (`ecards_db`)

**Purpose:** Normalized relational data (users, templates, jobs, etc.)

**Status:**
- ✅ Database auto-created from `POSTGRES_DB` env var
- ⚠️ No tables yet (schemas marked as MOCK/TODO)
- 📋 Tables will be created via Prisma migrations when implemented

**Connection:**
- Host: `localhost` (from host) / `postgres` (from containers)
- Port: `7432` (host) / `5432` (internal)
- Database: `ecards_db`
- User: `ecards_user`
- Password: `ecards_dev_password`

### Cassandra (`ecards_canonical`)

**Purpose:** High-volume event logs and canonical data

**Status:**
- ✅ Container running
- ✅ Keyspace auto-created by db-init service
- ✅ All tables auto-created from `db/init-cassandra/*.cql`
- ⚠️ Materialized views disabled (Cassandra 5.0 default)
- ✅ Fully automated - no manual steps required

**Schema Files** (executed in order):
- `01-create-keyspace.cql` - Creates keyspace
- `02-template-storage.cql` - Template & storage tables
- `03-template-textile-tables.cql` - Textile feature tables
- `05-batch-upload-tables.cql` - Batch upload tables
- `06-contact-records.cql` - Contact records table

**Configuration:**
- Keyspace: `ecards_canonical`
- Replication: `SimpleStrategy` with factor `1` (dev only)
- Data Center: `dc1`
- Materialized Views: Disabled (can be enabled if needed)

**Connection:**
- Host: `localhost` (from host) / `cassandra` (from containers)
- Port: `7042` (host) / `9042` (internal)

**Recent Updates (2025-01-25):**
- ✅ Automated initialization via db-init service
- ✅ Schema consolidation (single source of truth)
- ✅ Materialized views commented out (Cassandra 5.0 limitation)
- 📋 See `.claude/fixes/MATERIALIZED-VIEWS-FIX.md` for details

### Redis

**Purpose:** Job queue (BullMQ) and caching

**Status:** ✅ Fully working, no initialization needed

**Connection:**
- Host: `localhost` (from host) / `redis` (from containers)
- Port: `7379` (host) / `6379` (internal)

## Complete Setup Workflow

When setting up the project from scratch:

```bash
# 1. Copy environment file
cp .env.dev.example .env

# 2. Start all services (schemas auto-created!)
docker-compose -f docker-compose.dev.yml up -d

# 3. Watch initialization (optional)
docker-compose -f docker-compose.dev.yml logs -f db-init

# 4. Verify services are healthy
docker-compose -f docker-compose.dev.yml ps

# Expected: All services "Up" and healthy
# - postgres (healthy)
# - cassandra (healthy)
# - redis (healthy)
# - db-init (exited 0) ← This is normal, it runs once
# - api-server (up)
# - front-cards (up)
# - render-worker (up)

# 5. Check api-server logs
docker logs ecards-api

# Should see:
# ✅ Connected to Cassandra cluster
# ✅ Keyspace "ecards_canonical" exists
# ✅ All critical tables verified
```

**That's it!** No manual initialization needed.

## Troubleshooting

### Error: "Cassandra is unavailable"

**Cause:** Cassandra takes 30-60 seconds to fully start

**Solution:**
```bash
# Check if Cassandra is running
docker ps | grep cassandra

# Check Cassandra logs
docker logs ecards-cassandra

# Wait for this message:
# "Starting listening for CQL clients"

# Then run init script
```

### Error: "Keyspace already exists"

**Cause:** Keyspace was already created

**Solution:** This is fine! The init script uses `CREATE KEYSPACE IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "Connection refused"

**Cause:** Cassandra port not exposed or container not running

**Solution:**
```bash
# Check if container is running
docker ps | grep cassandra

# Check port mapping
docker port ecards-cassandra

# Restart Cassandra
docker-compose -f docker-compose.dev.yml restart cassandra
```

### API Server Keeps Failing to Connect

**Cause:** API server starts before Cassandra schemas are created

**Solution:**
This should not happen anymore with db-init service. If it does:

```bash
# Check db-init logs for errors
docker-compose -f docker-compose.dev.yml logs db-init

# If db-init failed, restart it
docker-compose -f docker-compose.dev.yml restart db-init

# Wait for db-init to complete, then restart api-server
docker-compose -f docker-compose.dev.yml restart api-server
```

### Materialized Views Error

**Error:** `Materialized views are disabled`

**Cause:** Cassandra 5.0 has materialized views disabled by default

**Solution:** Already fixed! All materialized views are commented out in schema files.

If you need to enable them:
1. See `.claude/fixes/MATERIALIZED-VIEWS-FIX.md`
2. Enable in Cassandra config
3. Uncomment views in schema files

## ✅ Automation Complete (2025-01-25)

**Automated initialization is now implemented!**

The db-init service uses:
- ✅ Docker healthchecks (waits for Cassandra to be ready)
- ✅ Dependency ordering (cassandra → db-init → api-server)
- ✅ Automated script execution (all `.cql` files in `db/init-cassandra/`)

**No manual steps required!**

### Schema Updates

**Cassandra Tables:**
1. Edit/add files in `db/init-cassandra/*.cql`
2. Restart db-init: `docker-compose -f docker-compose.dev.yml restart db-init`
3. Or full reset: `docker-compose down -v && docker-compose up -d`

**PostgreSQL Tables:**
1. Define models in `api-server/prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev`
3. Apply migration: `npx prisma migrate deploy`

## Production Considerations

### Cassandra Production Setup

**Change replication strategy in `db/init-cassandra/01-create-keyspace.cql`:**

```cql
CREATE KEYSPACE IF NOT EXISTS ecards_canonical
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3,
  'datacenter2': 3
}
AND durable_writes = true;
```

**Additional production configs:**
- Use multiple Cassandra nodes (cluster)
- Enable authentication
- Configure backup/restore procedures
- Set up monitoring (nodetool, DataStax OpsCenter)

### PostgreSQL Production Setup

- Use managed service (AWS RDS, Google Cloud SQL, etc.)
- Enable automated backups
- Configure read replicas
- Use connection pooling (PgBouncer)
- Enable point-in-time recovery

## Summary

✅ **What's Working (Updated 2025-01-25):**
- ✅ Fully automated Cassandra initialization via db-init service
- ✅ All schemas created from `db/init-cassandra/*.cql`
- ✅ Materialized views disabled (Cassandra 5.0 compatibility)
- ✅ Project IDs auto-generated (no hardcoded values)
- ✅ No manual initialization required
- ✅ Docker dependency ordering (cassandra → db-init → api-server)

⚠️ **Known Limitations:**
- ⚠️ Materialized views disabled (can be enabled if needed)
- ⚠️ Development replication factor: 1 (production should use 3+)

📋 **Quick Start:**
```bash
# That's it! Everything auto-initializes
docker-compose -f docker-compose.dev.yml up -d

# Verify
docker-compose -f docker-compose.dev.yml logs db-init
docker-compose -f docker-compose.dev.yml logs api-server | grep Cassandra
```

**For detailed fix documentation, see:**
- `.claude/fixes/CASSANDRA-SCHEMA-CONSOLIDATION-SUMMARY.md`
- `.claude/fixes/MATERIALIZED-VIEWS-FIX.md`
- `.claude/fixes/PRISMA-UNIQUE-CONSTRAINT-FIX.md`

## Need Help?

If you continue to see database connection errors:

1. Check all containers are running: `docker-compose -f docker-compose.dev.yml ps`
2. Check container logs: `docker logs ecards-cassandra`, `docker logs ecards-postgres`
3. Verify environment variables: `docker exec ecards-api env | grep CASSANDRA`
4. Try complete reset (see "Option 3: Reset and Reinitialize" above)
