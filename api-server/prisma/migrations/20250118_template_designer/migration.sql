-- CreateEnum for template types
CREATE TYPE template_type AS ENUM ('vcard', 'qr_square', 'qr_vertical');

-- CreateEnum for template status
CREATE TYPE template_status AS ENUM ('draft', 'active', 'archived');

-- CreateEnum for export formats
CREATE TYPE export_format AS ENUM ('jpg', 'png');

-- CreateEnum for resource types
CREATE TYPE resource_type AS ENUM ('font', 'icon', 'image', 'background');

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type template_type NOT NULL,
    status template_status DEFAULT 'draft',
    background_url TEXT,
    thumbnail_url TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    export_format export_format DEFAULT 'png',
    export_dpi INTEGER DEFAULT 300,
    phone_prefix VARCHAR(20),
    extension_length INTEGER DEFAULT 4,
    website_url TEXT,
    brand_colors JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_user_project_name_idx UNIQUE (user_id, project_id, name)
);

-- Template resources table
CREATE TABLE IF NOT EXISTS template_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    type resource_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_templates_user_project ON templates(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_resources_user_project ON template_resources(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON template_resources(type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for templates table
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();