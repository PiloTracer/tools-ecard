-- Cassandra schema initialization for E-Cards batch parsing
-- This script creates the keyspace and contact_records table
-- Field names strictly match front-cards/features/template-textile/utils/vcardFields.ts

-- Create keyspace with replication
CREATE KEYSPACE IF NOT EXISTS ecards
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
};

USE ecards;

-- Contact records table - stores complete vCard data
-- PRIMARY KEY = batch_record_id (one-to-one with PostgreSQL batch_records)
-- This enables direct lookups: given a batch_record_id from PostgreSQL,
-- retrieve the full contact details from Cassandra
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
