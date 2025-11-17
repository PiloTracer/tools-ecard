# Database Setup Guide

## The Issue

When starting the application, you may see this error:

```
❌ Failed to connect to Cassandra: ResponseError: Keyspace 'ecards_canonical' does not exist
```

**Why this happens:**
- The Cassandra container is running successfully
- The application is trying to connect to keyspace `ecards_canonical`
- The keyspace hasn't been created yet (initialization scripts need to be run)

**Note:** Unlike PostgreSQL (which auto-creates the database from env vars), Cassandra requires explicit keyspace creation via CQL scripts.

## Quick Fix

### Option 1: Run Initialization Script (Recommended)

**Windows:**
```bash
scripts\init-cassandra.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/init-cassandra.sh
./scripts/init-cassandra.sh
```

**What this does:**
1. Waits for Cassandra to be fully ready
2. Executes the keyspace creation script
3. Verifies the setup is complete

### Option 2: Manual Initialization

If the script doesn't work, run manually:

```bash
# Wait for Cassandra to be ready (may take 30-60 seconds)
docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES"

# Create the keyspace
docker exec ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql

# Verify keyspace was created
docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES" | grep ecards_canonical
```

### Option 3: Reset and Reinitialize

If you want a completely fresh start:

```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down

# Remove Cassandra volume (deletes all data!)
docker volume rm tools-ecards_cassandra_data

# Start Cassandra container
docker-compose -f docker-compose.dev.yml up -d cassandra

# Wait 60 seconds for Cassandra to fully start
# (Important: Cassandra takes longer to start than other databases)

# Run initialization script
scripts\init-cassandra.bat   # Windows
# OR
./scripts/init-cassandra.sh  # Linux/Mac

# Start remaining services
docker-compose -f docker-compose.dev.yml up -d
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
- ✅ Keyspace creation script created (`db/init-cassandra/01-create-keyspace.cql`)
- ⚠️ Keyspace not auto-created (requires manual initialization)
- ⚠️ No tables yet (schemas marked as MOCK/TODO)

**Configuration:**
- Keyspace: `ecards_canonical`
- Replication: `SimpleStrategy` with factor `1` (dev only)
- Data Center: `dc1`

**Connection:**
- Host: `localhost` (from host) / `cassandra` (from containers)
- Port: `7042` (host) / `9042` (internal)

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

# 2. Start all services
docker-compose -f docker-compose.dev.yml up -d

# 3. Wait for Cassandra to be ready (important!)
#    This can take 30-60 seconds
echo "Waiting for Cassandra..."
sleep 60

# 4. Initialize Cassandra keyspace
scripts\init-cassandra.bat   # Windows
# OR
./scripts/init-cassandra.sh  # Linux/Mac

# 5. Verify services are healthy
docker-compose -f docker-compose.dev.yml ps

# 6. Check logs
docker logs ecards-api       # Should see "✅ Connected to Cassandra"
docker logs ecards-postgres  # Should show database ready
docker logs ecards-cassandra # Should show keyspace exists
```

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

**Cause:** API server starts before Cassandra is ready

**Solution:**
1. Make sure Cassandra is fully initialized first
2. Then restart the API server:
   ```bash
   docker-compose -f docker-compose.dev.yml restart api-server
   ```

## Future Improvements

### Automated Initialization

The init scripts are already in place at `db/init-cassandra/`. To make initialization automatic:

1. **Option A:** Create a custom Cassandra Dockerfile with an initialization entrypoint
2. **Option B:** Use Docker healthchecks and depends_on conditions
3. **Option C:** Add initialization check to api-server startup

**Current approach:** Manual one-time initialization via script (simpler, explicit)

### Schema Implementation

Once domain models are defined:

**Cassandra Tables:**
1. Add table definitions to `db/init-cassandra/02-create-tables.cql`
2. Reset Cassandra volume to apply
3. Or run the script manually with `cqlsh -f`

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

✅ **What's Fixed:**
- Created Cassandra keyspace initialization script
- Created initialization helper scripts for Windows/Linux/Mac
- Added PostgreSQL placeholder script
- Documented complete setup workflow

⚠️ **What's Still TODO:**
- Table schemas (Cassandra and PostgreSQL)
- Domain model implementation
- Automated initialization on container startup
- Production-ready replication configuration

📋 **Next Steps:**
1. Run `scripts\init-cassandra.bat` (or `.sh` on Linux/Mac)
2. Restart api-server: `docker-compose -f docker-compose.dev.yml restart api-server`
3. Verify: `docker logs ecards-api` should show "✅ Connected to Cassandra"

## Need Help?

If you continue to see database connection errors:

1. Check all containers are running: `docker-compose -f docker-compose.dev.yml ps`
2. Check container logs: `docker logs ecards-cassandra`, `docker logs ecards-postgres`
3. Verify environment variables: `docker exec ecards-api env | grep CASSANDRA`
4. Try complete reset (see "Option 3: Reset and Reinitialize" above)
