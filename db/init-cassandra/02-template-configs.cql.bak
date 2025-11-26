-- Create keyspace if not exists (should already exist from 01-create-keyspace.cql)
USE ecards_canonical;

-- Template configurations with versioning
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

-- Template events for audit trail
CREATE TABLE IF NOT EXISTS template_events (
    template_id UUID,
    event_timestamp TIMESTAMP,
    event_type TEXT,  -- 'created', 'updated', 'deleted', 'published', 'archived'
    user_id TEXT,
    project_id TEXT,
    event_data TEXT,  -- JSON event details
    PRIMARY KEY (template_id, event_timestamp)
) WITH CLUSTERING ORDER BY (event_timestamp DESC)
  AND comment = 'Audit trail for template operations';

-- Resource upload events
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

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_template_configs_user ON template_configs (user_id);
CREATE INDEX IF NOT EXISTS idx_template_configs_project ON template_configs (project_id);
CREATE INDEX IF NOT EXISTS idx_template_events_user ON template_events (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_events_user ON resource_events (user_id);
CREATE INDEX IF NOT EXISTS idx_resource_events_project ON resource_events (project_id);