-- Cassandra schema for batch upload feature
-- This creates tables for storing parsed batch records

USE ecards_canonical;

-- Table to store parsed batch records
-- Each record represents a parsed contact from a batch file
CREATE TABLE IF NOT EXISTS batch_records (
    batch_id UUID,
    record_id UUID,
    -- Name fields (from vCard parsing)
    full_name TEXT,
    given_name TEXT,
    family_name TEXT,
    middle_name TEXT,
    prefix TEXT,
    suffix TEXT,
    -- Contact fields
    email TEXT,
    phone TEXT,
    phone_work TEXT,
    phone_home TEXT,
    phone_cell TEXT,
    -- Organization fields
    organization TEXT,
    title TEXT,
    department TEXT,
    -- Address fields
    street_address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    -- Additional fields
    website TEXT,
    notes TEXT,
    -- Metadata
    parse_status TEXT, -- 'success' | 'partial' | 'failed'
    parse_errors LIST<TEXT>,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (batch_id, record_id)
) WITH CLUSTERING ORDER BY (record_id ASC)
  AND comment = 'Stores parsed contact records from batch uploads';

-- Index for querying by email
CREATE INDEX IF NOT EXISTS idx_batch_records_email ON batch_records (email);

-- Index for querying by organization
CREATE INDEX IF NOT EXISTS idx_batch_records_organization ON batch_records (organization);

-- Table to store batch processing events (audit log)
CREATE TABLE IF NOT EXISTS batch_events (
    batch_id UUID,
    event_id TIMEUUID,
    event_type TEXT, -- 'uploaded' | 'parsing_started' | 'record_parsed' | 'parsing_completed' | 'error'
    event_data TEXT, -- JSON string with event details
    user_email TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (batch_id, event_id)
) WITH CLUSTERING ORDER BY (event_id DESC)
  AND comment = 'Event log for batch processing activities';

-- Index for querying by user email
CREATE INDEX IF NOT EXISTS idx_batch_events_user_email ON batch_events (user_email);

-- Table for batch import mappings (field mappings for CSV/text imports)
CREATE TABLE IF NOT EXISTS batch_mappings (
    batch_id UUID,
    source_column TEXT,
    target_field TEXT,
    transform_rule TEXT, -- Optional transformation rule (e.g., 'uppercase', 'parse_phone')
    created_at TIMESTAMP,
    PRIMARY KEY (batch_id, source_column)
) WITH comment = 'Stores field mapping configurations for batch imports';