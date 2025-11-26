-- ============================================================
-- Contact Records - Cassandra Schema
-- ============================================================
--
-- Purpose: Store complete vCard contact data for batch parsing
-- Version: 1.0
-- Date: 2025-01-25
--
-- This schema stores full contact details for batch-parsed records.
-- Field names strictly match front-cards/features/template-textile/utils/vcardFields.ts
-- ============================================================

-- Ensure we're using the correct keyspace
USE ecards_canonical;

-- ============================================================
-- Contact records table - stores complete vCard data
-- ============================================================
-- PRIMARY KEY = batch_record_id (one-to-one with PostgreSQL batch_records)
-- This enables direct lookups: given a batch_record_id from PostgreSQL,
-- retrieve the full contact details from Cassandra
--
-- ACTIVELY USED by: api-server/src/features/batch-parsing/repositories/batchRecordRepository.ts
CREATE TABLE IF NOT EXISTS contact_records (
    -- Primary key links to PostgreSQL batch_records.id
    batch_record_id UUID PRIMARY KEY,

    -- Parent batch reference
    batch_id UUID,

    -- Timestamps
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- Core Contact Fields (matching vcardFields.ts)
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,

    -- Contact Methods
    work_phone TEXT,
    work_phone_ext TEXT,
    mobile_phone TEXT,
    email TEXT,

    -- Address (structured)
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal TEXT,
    address_country TEXT,

    -- Social Profiles
    social_instagram TEXT,
    social_twitter TEXT,
    social_facebook TEXT,

    -- Business Fields
    business_name TEXT,
    business_title TEXT,
    business_department TEXT,
    business_url TEXT,
    business_hours TEXT,

    -- Business Address (optional override)
    business_address_street TEXT,
    business_address_city TEXT,
    business_address_state TEXT,
    business_address_postal TEXT,
    business_address_country TEXT,

    -- Professional Profiles
    business_linkedin TEXT,
    business_twitter TEXT,

    -- Personal Fields
    personal_url TEXT,
    personal_bio TEXT,
    personal_birthday TEXT,

    -- Extra fields for future extensibility
    extra MAP<TEXT, TEXT>
) WITH compaction = {'class': 'LeveledCompactionStrategy'}
  AND gc_grace_seconds = 864000
  AND comment = 'Complete contact records linked to PostgreSQL batch_records via batch_record_id';

-- ============================================================
-- Indexes for efficient querying
-- ============================================================

-- Index for querying by batch (useful for batch operations)
CREATE INDEX IF NOT EXISTS idx_contact_records_batch_id ON contact_records (batch_id);

-- Index for querying by email (common search use case)
CREATE INDEX IF NOT EXISTS idx_contact_records_email ON contact_records (email);

-- Index for querying by business name
CREATE INDEX IF NOT EXISTS idx_contact_records_business_name ON contact_records (business_name);

-- ============================================================
-- Notes
-- ============================================================
--
-- 1. Data Model:
--    - One contact record per batch_record_id (1:1 relationship with PostgreSQL)
--    - PostgreSQL stores searchable subset (5 fields)
--    - Cassandra stores complete vCard data (30+ fields)
--
-- 2. Compaction Strategy:
--    - Uses LeveledCompactionStrategy for read-heavy workload
--    - Optimized for frequent reads by batch_record_id
--
-- 3. Field Naming Convention:
--    - Snake_case to match Cassandra conventions
--    - Must match vcardFields.ts field names
--
-- 4. Extra Fields:
--    - MAP type allows dynamic extension
--    - Use for custom fields not in standard vCard
--
-- ============================================================
