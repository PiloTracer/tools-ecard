# Template-Textile Cassandra Schema

## Overview

This document describes the Cassandra schema for the template-textile feature, including tables for event logging and metadata storage.

## Schema Files

- **03-template-textile-tables.cql**: Main schema file containing:
  - `textile_template_events` - Event logging table for template operations
  - `textile_template_metadata_blob` - Large metadata storage table
  - Supporting indexes and materialized views

## Tables

### 1. textile_template_events

Event logging table for tracking all template-textile operations.

**Structure:**
```sql
PRIMARY KEY ((template_id), event_timestamp, event_id)
```

**Fields:**
- `event_id` (UUID): Unique event identifier
- `template_id` (UUID): Template identifier (partition key)
- `user_id` (TEXT): User who performed the action
- `event_type` (TEXT): Type of event ('created', 'updated', 'deleted', 'opened', 'exported')
- `event_timestamp` (TIMESTAMP): When the event occurred
- `metadata` (TEXT): JSON blob with additional event data

**Features:**
- Time-series optimized with DESC clustering order
- 90-day TTL for automatic data expiration
- TimeWindowCompactionStrategy for efficient time-series storage

### 2. textile_template_metadata_blob

Storage for large metadata associated with templates.

**Structure:**
```sql
PRIMARY KEY (template_id)
```

**Fields:**
- `template_id` (UUID): Template identifier (primary key)
- `user_id` (TEXT): User who owns the template
- `metadata_json` (TEXT): Large JSON blob for extended metadata
- `updated_at` (TIMESTAMP): Last update timestamp

## How to Apply the Schema

### Option 1: Automatic on Container Restart

The schema will be automatically applied when you restart the containers:

```bash
# Stop and start containers (preserves data)
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d

# Or rebuild if needed
docker-compose -f docker-compose.dev.yml up -d --build
```

### Option 2: Apply to Running Container

Apply the schema without restarting:

#### Windows (PowerShell/CMD):
```batch
cd db\init-cassandra
apply-textile-schema.bat
```

#### Linux/Mac/Git Bash:
```bash
cd db/init-cassandra
./apply-textile-schema.sh
```

### Option 3: Manual Application

Apply manually using Docker commands:

```bash
# Copy schema to container
docker cp db/init-cassandra/03-template-textile-tables.cql ecards-cassandra:/tmp/

# Apply schema
docker exec ecards-cassandra cqlsh -f /tmp/03-template-textile-tables.cql

# Verify tables
docker exec ecards-cassandra cqlsh -e "USE ecards_canonical; DESCRIBE TABLES;" | grep textile
```

## Verification

After applying the schema, verify it was created correctly:

```bash
# Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

# In CQL shell:
USE ecards_canonical;
DESCRIBE TABLE textile_template_events;
DESCRIBE TABLE textile_template_metadata_blob;

# List all tables
DESCRIBE TABLES;
```

You should see:
- `textile_template_events`
- `textile_template_metadata_blob`
- `textile_events_by_user` (materialized view)
- `textile_events_by_type` (materialized view)

## Testing

Test the schema with sample inserts:

```sql
-- Connect to Cassandra
docker exec -it ecards-cassandra cqlsh

-- Use keyspace
USE ecards_canonical;

-- Insert test event
INSERT INTO textile_template_events (
    event_id, template_id, user_id, event_type, event_timestamp, metadata
) VALUES (
    uuid(),
    550e8400-e29b-41d4-a716-446655440000,
    'test-user',
    'created',
    toTimestamp(now()),
    '{"test": "data"}'
);

-- Query events
SELECT * FROM textile_template_events WHERE template_id = 550e8400-e29b-41d4-a716-446655440000;
```

## Troubleshooting

### Container not running
```bash
# Start Cassandra container
docker-compose -f docker-compose.dev.yml up -d cassandra

# Wait for it to be healthy
docker-compose -f docker-compose.dev.yml ps
```

### Schema already exists
The schema uses `IF NOT EXISTS` clauses, so it's safe to run multiple times.

### Permission issues on Windows
Run PowerShell or CMD as Administrator if you encounter permission issues.

## Notes

1. **Table Naming**: Uses `textile_` prefix to avoid conflicts with existing tables
2. **TTL**: Events auto-expire after 90 days (configurable)
3. **Compaction**: Optimized for time-series data with TimeWindowCompactionStrategy
4. **Indexes**: Secondary indexes on user_id and event_type for efficient queries
5. **Materialized Views**: Pre-computed views for user-centric and type-based queries

## Related Files

- `01-create-keyspace.cql`: Creates the main keyspace
- `02-template-configs.cql`: General template configuration tables
- `docker-compose.dev.yml`: Updated to run all `.cql` files in order