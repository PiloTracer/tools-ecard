-- Font Management Schema
-- Stores global and user-specific fonts with SeaweedFS references
-- Date: 2025-11-26

USE ecards_canonical;

-- Fonts table (partitioned by user_id for isolation)
CREATE TABLE IF NOT EXISTS fonts (
    font_id text,              -- UUID for the font
    user_id text,              -- User who uploaded (NULL for global fonts)
    font_name text,            -- Display name (e.g., "Montserrat Bold")
    font_family text,          -- CSS font-family value (e.g., "Montserrat")
    font_category text,        -- 'serif', 'sans-serif', 'display', 'handwriting', 'monospace'
    font_variant text,         -- 'regular', 'bold', 'italic', 'bold-italic'
    font_weight int,           -- 400, 700, etc.
    font_style text,           -- 'normal', 'italic'
    seaweedfs_url text,        -- SeaweedFS file URL
    seaweedfs_fid text,        -- SeaweedFS file ID (for deletion)
    google_font_family text,   -- Original Google Font family name (if applicable)
    is_system_font boolean,    -- true for global fonts, false for user uploads
    file_size bigint,          -- File size in bytes
    created_at timestamp,
    created_by text,           -- Admin who loaded global font
    PRIMARY KEY ((user_id), font_id)
) WITH CLUSTERING ORDER BY (font_id ASC);

-- Index for querying global fonts (user_id = null)
CREATE INDEX IF NOT EXISTS fonts_system_idx ON fonts (is_system_font);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS fonts_category_idx ON fonts (font_category);

-- Index for font family lookup
CREATE INDEX IF NOT EXISTS fonts_family_idx ON fonts (font_family);
