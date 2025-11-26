-- ============================================================
-- Template Storage - Consolidated Cassandra Schema
-- ============================================================
--
-- Purpose: Unified schema for template storage, events, and resources
-- Version: 3.0 (Consolidated from old 02-template-configs.cql and 04-template-multimode-tables.cql)
-- Date: 2025-01-25
--
-- IMPORTANT: This file consolidates two previous schema versions.
-- If you have existing tables, see SCHEMA-MIGRATION-NOTES.md for migration steps.
-- ============================================================

-- Ensure we're using the correct keyspace
USE ecards_canonical;

-- ============================================================
-- LEGACY TABLES (from old 02-template-configs.cql)
-- Currently not actively used by code, but kept for future use
-- ============================================================

-- Template configurations with versioning
-- NOTE: Not currently used by cassandraClient, kept for backward compatibility
CREATE TABLE IF NOT EXISTS template_configs (
    template_id UUID,
    version INT,
    user_id TEXT,
    project_id TEXT,
    elements TEXT,  -- JSON array of elements
    global_settings TEXT,  -- JSON settings
    metadata TEXT,  -- JSON metadata
    timestamp TIMESTAMP,
    PRIMARY KEY (template_id, version)
) WITH CLUSTERING ORDER BY (version DESC)
  AND comment = 'Stores template element configurations with versioning';

-- Resource upload events
-- NOTE: Different from resource_metadata table below
CREATE TABLE IF NOT EXISTS resource_events (
    resource_id UUID,
    event_timestamp TIMESTAMP,
    user_id TEXT,
    project_id TEXT,
    resource_type TEXT,  -- 'font', 'icon', 'image', 'background'
    resource_url TEXT,
    file_size BIGINT,
    mime_type TEXT,
    metadata TEXT,  -- JSON metadata
    PRIMARY KEY (resource_id, event_timestamp)
) WITH CLUSTERING ORDER BY (event_timestamp DESC)
  AND comment = 'Track resource upload events';

-- Template usage analytics
CREATE TABLE IF NOT EXISTS template_analytics (
    template_id UUID,
    date DATE,
    hour INT,
    usage_count COUNTER,
    PRIMARY KEY ((template_id, date), hour)
) WITH CLUSTERING ORDER BY (hour ASC)
  AND comment = 'Track template usage statistics';

-- ============================================================
-- ACTIVE TABLES (from old 04-template-multimode-tables.cql)
-- Currently used by cassandraClient.ts - DO NOT REMOVE
-- ============================================================

-- Template metadata with multi-mode support
-- ACTIVELY USED by cassandraClient.ts
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

-- Template events with mode awareness
-- ACTIVELY USED by cassandraClient.ts
-- CONFLICT WARNING: If you have an old version of this table with different schema,
-- you must manually drop it first: DROP TABLE template_events;
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

-- Resource metadata with deduplication
-- ACTIVELY USED by cassandraClient.ts
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

-- Mode transitions tracking
-- ACTIVELY USED by cassandraClient.ts
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

-- Sync queue for pending operations
-- ACTIVELY USED by cassandraClient.ts
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

-- Storage backend health monitoring
-- ACTIVELY USED by cassandraClient.ts
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

-- Indexes for legacy tables
CREATE INDEX IF NOT EXISTS idx_template_configs_user ON template_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_template_configs_project ON template_configs (project_id);
CREATE INDEX IF NOT EXISTS idx_resource_events_user ON resource_events (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_events_project ON resource_events (project_id);

-- Indexes for active tables
CREATE INDEX IF NOT EXISTS idx_template_events_storage_mode ON template_events (storage_mode);
CREATE INDEX IF NOT EXISTS idx_template_events_sync_status ON template_events (sync_status);
CREATE INDEX IF NOT EXISTS idx_resource_metadata_storage_mode ON resource_metadata (storage_mode);
CREATE INDEX IF NOT EXISTS idx_sync_queue_item_type ON sync_queue (item_type);
CREATE INDEX IF NOT EXISTS idx_mode_transitions_trigger ON mode_transitions (trigger);

-- ============================================================
-- Materialized Views for Optimized Queries
-- ============================================================
--
-- NOTE: Materialized views are DISABLED by default in Cassandra 5.0
-- They are commented out to allow schema initialization to succeed.
--
-- To enable materialized views:
-- 1. Edit cassandra.yaml and set: materialized_views_enabled: true
-- 2. Restart Cassandra
-- 3. Uncomment the views below and run this script again
--
-- See: https://cassandra.apache.org/doc/latest/cassandra/cql/mv.html
-- ============================================================

/*
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
    SELECT user_id, queue_id, item_type, operation, priority, created_at, data_json, retry_count, max_retries
    FROM sync_queue
    WHERE user_id IS NOT NULL
      AND priority IS NOT NULL
      AND created_at IS NOT NULL
      AND queue_id IS NOT NULL
    PRIMARY KEY ((user_id), priority, created_at, queue_id)
    WITH CLUSTERING ORDER BY (priority DESC, created_at ASC, queue_id ASC)
    AND comment = 'Pending sync items organized by user for efficient processing';

-- View for recent mode transitions
CREATE MATERIALIZED VIEW IF NOT EXISTS recent_mode_transitions AS
    SELECT user_id, from_mode, to_mode, trigger, transition_time, success, reason, transition_id
    FROM mode_transitions
    WHERE user_id IS NOT NULL
      AND transition_time IS NOT NULL
      AND transition_id IS NOT NULL
    PRIMARY KEY ((trigger), transition_time, user_id, transition_id)
    WITH CLUSTERING ORDER BY (transition_time DESC, user_id ASC, transition_id ASC)
    AND comment = 'Recent mode transitions for monitoring';
*/

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
-- End of Schema
-- ============================================================
