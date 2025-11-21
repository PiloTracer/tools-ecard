-- ============================================================
-- Template Multi-Mode Storage - Enhanced Cassandra Schema
-- ============================================================
--
-- Purpose: Enhanced tables for multi-mode template storage
-- Version: 2.0
-- Date: 2025-01-20
--
-- This schema supports FULL, FALLBACK, and LOCAL_ONLY modes
-- with complete event logging and metadata tracking
-- ============================================================

-- Ensure we're using the correct keyspace
USE ecards_canonical;

-- ============================================================
-- Drop old tables and views from 02-template-configs.cql to avoid conflicts
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS templates_by_storage_mode;
DROP MATERIALIZED VIEW IF EXISTS pending_sync_by_user;
DROP MATERIALIZED VIEW IF EXISTS recent_mode_transitions;
DROP TABLE IF EXISTS template_events;
DROP TABLE IF EXISTS resource_metadata;
DROP TABLE IF EXISTS mode_transitions;
DROP TABLE IF EXISTS sync_queue;
DROP TABLE IF EXISTS storage_health;

-- ============================================================
-- Table: template_metadata
-- Purpose: Complete template metadata with mode tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS template_metadata (
    template_id UUID,
    user_id UUID,
    full_metadata TEXT,      -- Complete template JSON
    event_history TEXT,      -- All events as JSON array
    audit_trail TEXT,        -- Audit log
    storage_modes_used SET<TEXT>, -- Track all modes used
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY ((template_id), user_id)
) WITH comment = 'Complete template metadata with multi-mode support'
  AND gc_grace_seconds = 864000  -- 10 days
  AND compaction = {
    'class': 'SizeTieredCompactionStrategy',
    'max_threshold': 32,
    'min_threshold': 4
  };

-- ============================================================
-- Table: template_events
-- Purpose: Enhanced event logging with mode awareness
-- ============================================================
CREATE TABLE IF NOT EXISTS template_events (
    user_id UUID,
    template_id UUID,
    event_id TIMEUUID,
    event_type TEXT,         -- 'SAVE' | 'OPEN' | 'DELETE' | 'SYNC' | 'MODE_CHANGE'
    storage_mode TEXT,       -- 'full' | 'fallback' | 'local'
    event_data TEXT,         -- JSON
    sync_status TEXT,        -- 'local' | 'synced' | 'pending'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY ((user_id, template_id), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC)
  AND comment = 'Event logging with mode awareness for template operations'
  AND default_time_to_live = 15552000  -- 180 days TTL
  AND gc_grace_seconds = 864000  -- 10 days
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

-- ============================================================
-- Table: resource_metadata
-- Purpose: Track resources with deduplication info
-- ============================================================
CREATE TABLE IF NOT EXISTS resource_metadata (
    hash TEXT PRIMARY KEY,
    resource_id UUID,
    original_name TEXT,
    mime_type TEXT,
    size BIGINT,
    storage_url TEXT,
    storage_mode TEXT,
    reference_count INT,     -- Number of templates using this resource
    first_seen TIMESTAMP,
    last_accessed TIMESTAMP,
    metadata_json TEXT       -- Additional metadata
) WITH comment = 'Resource deduplication and tracking'
  AND gc_grace_seconds = 864000
  AND compaction = {
    'class': 'SizeTieredCompactionStrategy'
  };

-- ============================================================
-- Table: mode_transitions
-- Purpose: Track mode changes for analytics
-- ============================================================
CREATE TABLE IF NOT EXISTS mode_transitions (
    user_id UUID,
    transition_id TIMEUUID,
    from_mode TEXT,
    to_mode TEXT,
    trigger TEXT,            -- 'auto' | 'manual' | 'error'
    reason TEXT,
    transition_time TIMESTAMP,
    success BOOLEAN,
    error_details TEXT,
    PRIMARY KEY ((user_id), transition_time, transition_id)
) WITH CLUSTERING ORDER BY (transition_time DESC, transition_id DESC)
  AND comment = 'Track mode transitions for monitoring and debugging'
  AND default_time_to_live = 2592000  -- 30 days TTL
  AND gc_grace_seconds = 864000;

-- ============================================================
-- Table: sync_queue
-- Purpose: Track items pending synchronization
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    user_id UUID,
    queue_id UUID,
    item_type TEXT,          -- 'template' | 'resource' | 'deletion'
    item_id UUID,
    operation TEXT,          -- 'create' | 'update' | 'delete'
    priority INT,
    retry_count INT,
    max_retries INT,
    data_json TEXT,          -- Serialized data
    created_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    error_message TEXT,
    PRIMARY KEY ((user_id), priority, created_at, queue_id)
) WITH CLUSTERING ORDER BY (priority DESC, created_at ASC, queue_id ASC)
  AND comment = 'Queue for pending synchronization operations'
  AND default_time_to_live = 604800  -- 7 days TTL
  AND gc_grace_seconds = 86400;

-- ============================================================
-- Table: storage_health
-- Purpose: Track storage backend health metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS storage_health (
    backend TEXT,            -- 'seaweedfs' | 'fallback' | 'postgresql' | 'cassandra'
    check_time TIMESTAMP,
    status TEXT,             -- 'healthy' | 'degraded' | 'unavailable'
    latency_ms INT,
    error_rate DECIMAL,
    free_space_bytes BIGINT,
    metadata_json TEXT,      -- Additional metrics
    PRIMARY KEY ((backend), check_time)
) WITH CLUSTERING ORDER BY (check_time DESC)
  AND comment = 'Storage backend health monitoring'
  AND default_time_to_live = 86400  -- 1 day TTL
  AND gc_grace_seconds = 3600;

-- ============================================================
-- Indexes for efficient querying
-- ============================================================

-- Index for querying events by storage mode
CREATE INDEX IF NOT EXISTS idx_template_events_storage_mode
    ON template_events (storage_mode);

-- Index for querying events by sync status
CREATE INDEX IF NOT EXISTS idx_template_events_sync_status
    ON template_events (sync_status);

-- Index for querying resources by storage mode
CREATE INDEX IF NOT EXISTS idx_resource_metadata_storage_mode
    ON resource_metadata (storage_mode);

-- Index for querying sync queue by item type
CREATE INDEX IF NOT EXISTS idx_sync_queue_item_type
    ON sync_queue (item_type);

-- Index for querying mode transitions by trigger
CREATE INDEX IF NOT EXISTS idx_mode_transitions_trigger
    ON mode_transitions (trigger);

-- ============================================================
-- Materialized Views for Optimized Queries
-- ============================================================

-- View for templates by storage mode
CREATE MATERIALIZED VIEW IF NOT EXISTS templates_by_storage_mode AS
    SELECT storage_mode, user_id, template_id, event_id, event_type, created_at, event_data
    FROM template_events
    WHERE storage_mode IS NOT NULL
      AND user_id IS NOT NULL
      AND template_id IS NOT NULL
      AND event_id IS NOT NULL
    PRIMARY KEY ((storage_mode), created_at, user_id, template_id, event_id)
    WITH CLUSTERING ORDER BY (created_at DESC, user_id ASC, template_id ASC, event_id ASC)
    AND comment = 'Templates organized by storage mode for mode-specific queries';

-- View for pending sync items
CREATE MATERIALIZED VIEW IF NOT EXISTS pending_sync_by_user AS
    SELECT user_id, queue_id, item_type, operation, priority, created_at, data_json
    FROM sync_queue
    WHERE user_id IS NOT NULL
      AND priority IS NOT NULL
      AND created_at IS NOT NULL
      AND queue_id IS NOT NULL
      AND retry_count < max_retries
    PRIMARY KEY ((user_id), priority, created_at, queue_id)
    WITH CLUSTERING ORDER BY (priority DESC, created_at ASC, queue_id ASC)
    AND comment = 'Pending sync items organized by user for efficient processing';

-- View for recent mode transitions
CREATE MATERIALIZED VIEW IF NOT EXISTS recent_mode_transitions AS
    SELECT user_id, from_mode, to_mode, trigger, transition_time, success, reason
    FROM mode_transitions
    WHERE user_id IS NOT NULL
      AND transition_time IS NOT NULL
      AND transition_id IS NOT NULL
    PRIMARY KEY ((trigger), transition_time, user_id, transition_id)
    WITH CLUSTERING ORDER BY (transition_time DESC, user_id ASC, transition_id ASC)
    AND comment = 'Recent mode transitions for monitoring';

-- ============================================================
-- User-Defined Types (UDTs) for structured data
-- ============================================================

-- Type for storage location information
CREATE TYPE IF NOT EXISTS storage_location (
    mode TEXT,
    url TEXT,
    path TEXT,
    bucket TEXT,
    region TEXT
);

-- Type for sync attempt information
CREATE TYPE IF NOT EXISTS sync_attempt (
    attempt_number INT,
    attempt_time TIMESTAMP,
    status TEXT,
    error_message TEXT,
    duration_ms INT
);

-- ============================================================
-- Sample Queries (Documentation)
-- ============================================================

/*
-- Get all events for a template in a specific mode
SELECT * FROM template_events
WHERE user_id = ? AND template_id = ? AND storage_mode = 'full'
LIMIT 100;

-- Get pending sync items for a user
SELECT * FROM sync_queue
WHERE user_id = ? AND retry_count < max_retries
ORDER BY priority DESC, created_at ASC;

-- Get recent mode transitions
SELECT * FROM mode_transitions
WHERE user_id = ?
AND transition_time > ?
ORDER BY transition_time DESC
LIMIT 50;

-- Check storage backend health
SELECT * FROM storage_health
WHERE backend = 'seaweedfs'
AND check_time > ?
ORDER BY check_time DESC
LIMIT 10;

-- Get resource by hash for deduplication
SELECT * FROM resource_metadata
WHERE hash = ?;
*/

-- ============================================================
-- Notes on Multi-Mode Architecture
-- ============================================================
--
-- 1. Mode Tracking:
--    - Every operation logs the current storage mode
--    - Mode transitions are tracked separately for analytics
--
-- 2. Sync Queue:
--    - Items created in LOCAL_ONLY mode are queued for sync
--    - Priority-based processing with retry logic
--
-- 3. Resource Deduplication:
--    - Resources tracked by content hash
--    - Reference counting for garbage collection
--
-- 4. Health Monitoring:
--    - Regular health checks for all storage backends
--    - Used for automatic failover decisions
--
-- 5. Data Retention:
--    - Events: 180 days (adjustable)
--    - Mode transitions: 30 days
--    - Sync queue: 7 days
--    - Health metrics: 1 day
--
-- ============================================================