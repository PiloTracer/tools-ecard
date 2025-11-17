# Database Initialization Scripts

This directory contains initialization scripts for the database containers.

## Structure

```
db/
├── init-cassandra/    # Cassandra CQL scripts
│   └── 01-create-keyspace.cql
├── init-postgres/     # PostgreSQL SQL scripts
│   └── 01-create-database.sql
└── README.md          # This file
```

## How It Works

### Docker Compose Integration

The `docker-compose.dev.yml` file mounts these directories as initialization scripts:

**Cassandra:**
```yaml
volumes:
  - ./db/init-cassandra:/docker-entrypoint-initdb.d
```

**PostgreSQL:**
```yaml
volumes:
  - ./db/init-postgres:/docker-entrypoint-initdb.d
```

### Execution Order

Scripts are executed in **alphanumeric order** by filename:
- `01-*.sql` runs first
- `02-*.sql` runs second
- etc.

### When Scripts Run

- **First container start**: All scripts in the directory are executed
- **Subsequent starts**: Scripts are NOT re-executed (unless you delete the volume)

## Current Setup

### Cassandra

**Keyspace**: `ecards_canonical`
- **Replication**: SimpleStrategy with factor 1 (development only)
- **Tables**: None yet (TODO)

**Purpose**: Store high-volume canonical event data and logs

**Environment Variables** (from `docker-compose.dev.yml`):
- `CASSANDRA_KEYSPACE=ecards_canonical`
- `CASSANDRA_DC=dc1`
- `CASSANDRA_RACK=rack1`

### PostgreSQL

**Database**: `ecards_db`
- **User**: `ecards_user`
- **Password**: Set via `POSTGRES_PASSWORD` env var
- **Tables**: None yet (created by Prisma migrations)

**Purpose**: Store normalized relational application data

**Environment Variables** (from `docker-compose.dev.yml`):
- `POSTGRES_DB=ecards_db`
- `POSTGRES_USER=ecards_user`
- `POSTGRES_PASSWORD=ecards_dev_password`

## Adding Tables

### Cassandra Tables

1. Create a new `.cql` file in `init-cassandra/`:
   ```bash
   touch db/init-cassandra/02-create-tables.cql
   ```

2. Define your tables:
   ```cql
   USE ecards_canonical;

   CREATE TABLE IF NOT EXISTS event_logs (
     id UUID PRIMARY KEY,
     timestamp TIMESTAMP,
     event_type TEXT,
     user_id TEXT,
     payload TEXT
   );
   ```

3. Recreate containers to apply:
   ```bash
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml up -d
   ```

### PostgreSQL Tables

PostgreSQL tables are managed by **Prisma migrations**, not init scripts.

1. Define models in `api-server/prisma/schema.prisma`:
   ```prisma
   model User {
     id        String   @id @default(uuid())
     email     String   @unique
     name      String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@map("users")
   }
   ```

2. Create migration:
   ```bash
   cd api-server
   npx prisma migrate dev --name init
   ```

3. Apply to production:
   ```bash
   npx prisma migrate deploy
   ```

## Resetting Databases

### Full Reset (Delete All Data)

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Delete volumes (WARNING: Deletes all data!)
docker volume rm tools-ecards_postgres_data
docker volume rm tools-ecards_cassandra_data
docker volume rm tools-ecards_redis_data

# Restart (will re-run init scripts)
docker-compose -f docker-compose.dev.yml up -d
```

### Reset Specific Database

**PostgreSQL:**
```bash
docker-compose -f docker-compose.dev.yml down
docker volume rm tools-ecards_postgres_data
docker-compose -f docker-compose.dev.yml up -d postgres
```

**Cassandra:**
```bash
docker-compose -f docker-compose.dev.yml down
docker volume rm tools-ecards_cassandra_data
docker-compose -f docker-compose.dev.yml up -d cassandra
```

## Troubleshooting

### "Keyspace does not exist" Error

**Symptom:**
```
❌ Failed to connect to Cassandra: ResponseError: Keyspace 'ecards_canonical' does not exist
```

**Cause**: Init scripts haven't run or failed to execute

**Solution:**
```bash
# 1. Check if init script exists
ls -la db/init-cassandra/

# 2. Delete volume and recreate
docker-compose -f docker-compose.dev.yml down
docker volume rm tools-ecards_cassandra_data
docker-compose -f docker-compose.dev.yml up -d

# 3. Check logs
docker logs ecards-cassandra
```

### "Database does not exist" Error

**Symptom:**
```
Error: database "ecards_db" does not exist
```

**Cause**: PostgreSQL database not created (shouldn't happen with env vars)

**Solution:**
```bash
# 1. Check environment variables
docker exec ecards-postgres env | grep POSTGRES

# 2. Manually create database
docker exec -it ecards-postgres psql -U ecards_user -d postgres
CREATE DATABASE ecards_db;
\q

# 3. Or reset volume
docker-compose -f docker-compose.dev.yml down
docker volume rm tools-ecards_postgres_data
docker-compose -f docker-compose.dev.yml up -d
```

### Init Scripts Not Running

**Check execution logs:**
```bash
# PostgreSQL init logs
docker logs ecards-postgres 2>&1 | grep -A 10 "init"

# Cassandra init logs
docker logs ecards-cassandra 2>&1 | grep -A 10 "init"
```

**Verify volumes are mounted:**
```bash
docker inspect ecards-postgres | grep -A 5 "Mounts"
docker inspect ecards-cassandra | grep -A 5 "Mounts"
```

## Production Considerations

### Cassandra

- Change replication strategy from `SimpleStrategy` to `NetworkTopologyStrategy`
- Increase replication factor to 3 for high availability
- Use separate datacenter configurations
- Enable compression and compaction strategies

**Example production keyspace:**
```cql
CREATE KEYSPACE IF NOT EXISTS ecards_canonical
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3
}
AND durable_writes = true;
```

### PostgreSQL

- Use managed PostgreSQL service (RDS, Cloud SQL, etc.)
- Enable automated backups
- Configure connection pooling
- Use read replicas for scaling
- Enable point-in-time recovery (PITR)

## Current Status

- ✅ Cassandra keyspace initialization script created
- ✅ PostgreSQL database initialization script created
- ⚠️ No tables defined yet (schemas marked as MOCK/TODO)
- 📋 Next: Implement domain models and create table schemas

## References

- [Cassandra CQL Documentation](https://cassandra.apache.org/doc/latest/cql/)
- [PostgreSQL Docker Init](https://hub.docker.com/_/postgres) - See "Initialization scripts" section
- [Cassandra Docker Init](https://hub.docker.com/_/cassandra) - See "Initialization" section
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
