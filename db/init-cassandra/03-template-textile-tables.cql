-- ============================================================
-- Template-Textile Feature - Cassandra Schema
-- ============================================================
--
-- Purpose: Create tables for the template-textile feature
-- Author: Claude
-- Date: 2025-11-20
--
-- This file creates the required Cassandra tables for the
-- template-textile feature according to the technical specifications.
-- ============================================================

-- Ensure we're using the correct keyspace
USE ecards_canonical;

-- ============================================================
-- Table: textile_template_events
-- Purpose: Event logging for template-textile operations
-- ============================================================
CREATE TABLE IF NOT EXISTS textile_template_events (
    event_id UUID,
    template_id UUID,
    user_id TEXT,
    event_type TEXT,  -- 'created', 'updated', 'deleted', 'opened', 'exported'
    event_timestamp TIMESTAMP,
    metadata TEXT,  -- JSON: Additional event data
    PRIMARY KEY ((template_id), event_timestamp, event_id)
) WITH CLUSTERING ORDER BY (event_timestamp DESC, event_id ASC)
  AND comment = 'Event logging for template-textile operations - time-series optimized'
  AND default_time_to_live = 7776000  -- 90 days TTL
  AND gc_grace_seconds = 864000  -- 10 days
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': 1
  };

-- ============================================================
-- Table: textile_template_metadata_blob
-- Purpose: Large metadata storage for template-textile
-- ============================================================
CREATE TABLE IF NOT EXISTS textile_template_metadata_blob (
    template_id UUID PRIMARY KEY,
    user_id TEXT,
    metadata_json TEXT,  -- Large JSON blob for extended metadata
    updated_at TIMESTAMP
) WITH comment = 'Large metadata storage for template-textile feature'
  AND gc_grace_seconds = 864000  -- 10 days
  AND compaction = {
    'class': 'SizeTieredCompactionStrategy'
  };

-- ============================================================
-- Indexes for efficient querying
-- ============================================================

-- Index for querying events by user
CREATE INDEX IF NOT EXISTS idx_textile_events_user
    ON textile_template_events (user_id);

-- Index for querying events by type
CREATE INDEX IF NOT EXISTS idx_textile_events_type
    ON textile_template_events (event_type);

-- Index for querying metadata blobs by user
CREATE INDEX IF NOT EXISTS idx_textile_metadata_user
    ON textile_template_metadata_blob (user_id);

-- ============================================================
-- Materialized Views (Optional - for optimized queries)
-- ============================================================

-- View for recent events by user (last 30 days)
CREATE MATERIALIZED VIEW IF NOT EXISTS textile_events_by_user AS
    SELECT user_id, template_id, event_id, event_type, event_timestamp, metadata
    FROM textile_template_events
    WHERE user_id IS NOT NULL
      AND template_id IS NOT NULL
      AND event_timestamp IS NOT NULL
      AND event_id IS NOT NULL
    PRIMARY KEY ((user_id), event_timestamp, template_id, event_id)
    WITH CLUSTERING ORDER BY (event_timestamp DESC, template_id ASC, event_id ASC)
    AND comment = 'Events organized by user for efficient user-centric queries';

-- View for events by type
CREATE MATERIALIZED VIEW IF NOT EXISTS textile_events_by_type AS
    SELECT event_type, template_id, event_id, user_id, event_timestamp, metadata
    FROM textile_template_events
    WHERE event_type IS NOT NULL
      AND template_id IS NOT NULL
      AND event_timestamp IS NOT NULL
      AND event_id IS NOT NULL
    PRIMARY KEY ((event_type), event_timestamp, template_id, event_id)
    WITH CLUSTERING ORDER BY (event_timestamp DESC, template_id ASC, event_id ASC)
    AND comment = 'Events organized by type for analytics and monitoring';

-- ============================================================
-- Sample Data (Optional - for testing)
-- ============================================================

-- Uncomment below to insert sample data for testing
/*
-- Sample event
INSERT INTO textile_template_events (
    event_id, template_id, user_id, event_type, event_timestamp, metadata
) VALUES (
    uuid(),
    550e8400-e29b-41d4-a716-446655440000,  -- Sample template ID
    'user123',
    'created',
    toTimestamp(now()),
    '{"version": "1.0", "source": "web", "browser": "Chrome"}'
);

-- Sample metadata blob
INSERT INTO textile_template_metadata_blob (
    template_id, user_id, metadata_json, updated_at
) VALUES (
    550e8400-e29b-41d4-a716-446655440000,
    'user123',
    '{"elements": [], "settings": {}, "history": []}',
    toTimestamp(now())
);
*/

-- ============================================================
-- Notes and Considerations
-- ============================================================
--
-- 1. TTL (Time To Live): Events auto-expire after 90 days
--    Adjust default_time_to_live if longer retention needed
--
-- 2. Compaction Strategy:
--    - Events table uses TimeWindowCompactionStrategy for time-series data
--    - Metadata table uses SizeTieredCompactionStrategy for large blobs
--
-- 3. Partition Key Design:
--    - Events: Partitioned by template_id for efficient template-centric queries
--    - Clustered by timestamp DESC for recent events first
--
-- 4. Secondary Indexes:
--    - Use sparingly as they can impact write performance
--    - Consider materialized views for complex query patterns
--
-- 5. Data Model Trade-offs:
--    - Optimized for write-heavy workload (event logging)
--    - Template-centric partitioning may create hot partitions for popular templates
--    - Consider adding bucketing (e.g., by month) if partition sizes grow too large
--
-- ============================================================