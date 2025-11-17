/*
 * Cassandra Keyspace Initialization
 *
 * Creates the main keyspace for canonical event data and logs
 *
 * NOTE: This is a minimal setup to allow the application to start.
 * TODO: Add table schemas when domain models are implemented
 */

-- Create keyspace with replication for development
CREATE KEYSPACE IF NOT EXISTS ecards_canonical
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
}
AND durable_writes = true;

-- Use the keyspace
USE ecards_canonical;

-- TODO: Add table definitions here
-- Example tables that might be needed:
--   - event_logs (for system events)
--   - render_jobs (for card rendering history)
--   - user_actions (for audit trail)
