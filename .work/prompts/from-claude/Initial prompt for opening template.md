# Template Open Functionality - Complete Specification

**Last Updated**: 2025-01-20
**Version**: 2.0 - Multi-Mode Architecture with Harmonious Storage Integration

## Overview

This document defines the complete implementation specification for opening templates in the template-textile feature. The open functionality retrieves templates from a harmoniously balanced multi-storage system that gracefully degrades based on authentication and service availability.

## CRITICAL: Three-Mode Architecture for Opening

The system operates in THREE distinct modes based on authentication and service availability:

### 1. FULL MODE (Authenticated + SeaweedFS Available)
- User is authenticated (valid JWT token)
- SeaweedFS is accessible and healthy
- All services operational
- Load resources from S3 as separate objects
- Full database support (PostgreSQL + Cassandra)
- Optimal performance with CDN caching

### 2. FALLBACK MODE (Authenticated + SeaweedFS Unavailable)
- User is authenticated (valid JWT token)
- SeaweedFS is down or unreachable
- `.local-storage` directory used as source
- PostgreSQL and Cassandra still operational
- System continues to function with local storage
- Seamless user experience maintained

### 3. LOCAL-ONLY MODE (Not Authenticated)
- No authentication available
- Browser-only operation
- IndexedDB/localStorage for all data
- No server communication
- Recent templates from browser cache
- Limited to locally saved templates

## Storage Architecture for Opening

### Harmonious Storage Integration

```
User Request → Mode Detection → Storage Selection
                              ↓
                    ┌─────────────────────┐
                    │   FULL MODE (S3)    │
                    │ SeaweedFS + Postgres │
                    └──────────┬──────────┘
                              ↓ (fallback)
                    ┌─────────────────────┐
                    │  FALLBACK MODE      │
                    │  .local-storage     │
                    └──────────┬──────────┘
                              ↓ (fallback)
                    ┌─────────────────────┐
                    │  LOCAL-ONLY MODE    │
                    │  Browser Storage    │
                    └─────────────────────┘
                              ↓
                    Canvas Editor (active editing)
```

### Storage Components with Fallback Cascade

1. **PostgreSQL** - Template metadata and permissions (when authenticated)
2. **SeaweedFS/S3** - Template JSON and resources (primary storage)
3. **.local-storage** - Server-side fallback (when S3 unavailable)
4. **Browser Cache** - Client-side cache and working copy
5. **IndexedDB** - Offline storage (when not authenticated)
6. **Memory/State** - Active editing state (Zustand)

## Authentication and Mode Detection

### NEVER Hardcode User Information
```typescript
// ❌ WRONG - Never hardcode userId or username
const openTemplate = async (templateId) => {
  const userId = "hardcoded-user-id"; // NEVER DO THIS
  // ...
}

// ✅ CORRECT - Extract from authentication context
const openTemplate = async (templateId) => {
  const auth = await authService.getCurrentUser();
  if (!auth.isAuthenticated) {
    return openLocalTemplate(templateId);
  }

  const { userId, username } = auth;
  // ...
}
```

### Mode Detection Before Opening
```typescript
async function detectOpenMode(): Promise<OpenMode> {
  // Step 1: Check authentication
  const auth = await authService.isAuthenticated();
  if (!auth) {
    return OpenMode.LOCAL_ONLY;
  }

  // Step 2: Check SeaweedFS health
  try {
    const health = await checkSeaweedFSHealth();
    if (health.status === 'healthy') {
      return OpenMode.FULL;
    }
  } catch (error) {
    console.warn('SeaweedFS unavailable, checking fallback');
  }

  // Step 3: Check if template exists in fallback
  const fallbackExists = await checkFallbackStorage(templateId);
  if (fallbackExists) {
    return OpenMode.FALLBACK;
  }

  // Last resort: local only
  return OpenMode.LOCAL_ONLY;
}
```

## Open Template Flow Specification

### Step 1: User Initiates Open

```typescript
interface OpenTemplateRequest {
  source: 'dialog' | 'recent' | 'shared' | 'url' | 'local';
  templateId?: string;
  projectId?: string;
  searchQuery?: string;
  mode?: OpenMode; // Client hint about detected mode
}
```

**UI Entry Points**:
- File menu → Open
- Toolbar open button
- Recent templates panel
- Shared with me section
- Direct URL access
- Local templates browser (offline mode)

### Step 2: Template Discovery with Mode Awareness

#### List Available Templates

```typescript
// API Endpoint
GET /api/templates
Query Parameters:
  - projectId?: string     // Filter by project
  - search?: string        // Search in name/description
  - tags?: string[]        // Filter by tags
  - sortBy?: 'name' | 'updated' | 'created'
  - sortOrder?: 'asc' | 'desc'
  - page?: number
  - pageSize?: number

Response: {
  templates: Array<{
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    thumbnailUrl?: string;
    width: number;
    height: number;
    elementCount: number;
    createdAt: Date;
    updatedAt: Date;
    lastAccessedAt?: Date;
    tags: string[];
    isShared: boolean;
    permission: 'owner' | 'edit' | 'view';
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

#### Permission Check

```typescript
async function checkTemplateAccess(
  userId: string,
  templateId: string
): Promise<AccessPermission> {
  // Check ownership
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { shares: true }
  });

  if (template.userId === userId) {
    return { level: 'owner', canEdit: true, canShare: true };
  }

  // Check shares
  const share = template.shares.find(s => s.sharedWith === userId);
  if (share) {
    return {
      level: share.permission,
      canEdit: share.permission === 'EDIT',
      canShare: false
    };
  }

  // Check if template is public
  if (template.isPublic) {
    return { level: 'view', canEdit: false, canShare: false };
  }

  throw new ForbiddenError('No access to this template');
}
```

### Step 3: Load Template Data with Mode-Specific Logic

#### FULL MODE - Load from SeaweedFS

```typescript
async function loadTemplateFullMode(templateId: string): Promise<LoadedTemplate> {
  // Extract user from auth context (NEVER hardcode)
  const { userId } = await authService.getUserContext();

  // 1. Verify permissions
  const permission = await checkTemplateAccess(userId, templateId);

  // 2. Fetch metadata from PostgreSQL
  const metadata = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      metadata: true,
      resources: true,
      project: {
        select: { id: true, name: true }
      }
    }
  });

  if (!metadata) {
    throw new NotFoundError('Template not found');
  }

  // 3. Fetch template JSON from S3
  try {
    const templateJson = await s3Service.getObject(
      'ecards',
      metadata.s3Key
    );

    const template = JSON.parse(
      await streamToString(templateJson.body)
    );

    // 4. Update last accessed timestamp
    await prisma.templateMetadata.update({
      where: { templateId },
      data: { lastAccessedAt: new Date() }
    });

    // 5. Log access event to Cassandra
    await cassandra.execute(
      `INSERT INTO template_events
       (user_id, template_id, event_id, event_type, storage_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, templateId, TimeUuid.now(), 'TEMPLATE_OPENED', 'full', new Date()]
    );

    return {
      template,
      metadata,
      permission,
      project: metadata.project,
      mode: 'full'
    };
  } catch (s3Error) {
    // S3 failed, try fallback
    console.warn('S3 load failed, trying fallback:', s3Error);
    return loadTemplateFallbackMode(templateId);
  }
}

#### FALLBACK MODE - Load from .local-storage

async function loadTemplateFallbackMode(templateId: string): Promise<LoadedTemplate> {
  // Extract user from auth context
  const { userId } = await authService.getUserContext();

  // 1. Check permissions in PostgreSQL
  const permission = await checkTemplateAccess(userId, templateId);

  // 2. Load template from .local-storage
  const localPath = `.local-storage/users/${userId}/templates/${templateId}/template.json`;

  try {
    const templateData = await fs.readFile(localPath, 'utf-8');
    const template = JSON.parse(templateData);

    // 3. Get metadata from PostgreSQL (still available)
    const metadata = await prisma.template.findUnique({
      where: { id: templateId },
      include: { project: true }
    });

    // 4. Log to Cassandra
    await cassandra.execute(
      `INSERT INTO template_events
       (user_id, template_id, event_id, event_type, storage_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, templateId, TimeUuid.now(), 'TEMPLATE_OPENED', 'fallback', new Date()]
    );

    return {
      template,
      metadata,
      permission,
      project: metadata.project,
      mode: 'fallback'
    };
  } catch (error) {
    // Fallback also failed, try browser cache
    return loadTemplateLocalMode(templateId);
  }
}

#### LOCAL-ONLY MODE - Load from Browser Storage

async function loadTemplateLocalMode(templateId: string): Promise<LoadedTemplate> {
  // No authentication - load from browser storage
  const cached = await browserStorage.getTemplate(templateId);

  if (!cached) {
    throw new NotFoundError('Template not found in local storage');
  }

  return {
    template: cached.template,
    metadata: cached.metadata,
    permission: { level: 'owner', canEdit: true }, // Local templates are always editable
    project: cached.project || { name: 'Local Project' },
    mode: 'local'
  };
}
```

### Step 4: Clear Previous State

```typescript
async function clearWorkingState(): Promise<void> {
  // 1. Clear browser local storage
  await browserStorage.clearWorkingTemplate();
  await browserStorage.clearResourceCache();

  // 2. Clear Zustand store
  templateStore.reset();

  // 3. Clear canvas
  canvas.clear();

  // 4. Reset undo/redo history
  historyManager.clear();

  // 5. Cancel any pending operations
  await cancelPendingUploads();
}
```

### Step 5: Load into Browser Storage

```typescript
async function loadIntoBrowser(template: Template): Promise<void> {
  // 1. Store template in IndexedDB
  await browserStorage.saveWorkingTemplate({
    ...template,
    loadedAt: new Date(),
    isModified: false
  });

  // 2. Identify resources to preload
  const resources = extractResourceUrls(template);

  // 3. Preload critical resources (parallel)
  const critical = resources.filter(r => r.priority === 'high');
  await Promise.all(
    critical.map(async (resource) => {
      const data = await fetchResource(resource.url);
      await browserStorage.cacheResource(resource.id, data);
    })
  );

  // 4. Queue non-critical resources for lazy loading
  const nonCritical = resources.filter(r => r.priority === 'low');
  resourceLoader.queueLazyLoad(nonCritical);
}
```

### Step 6: Initialize Editor

```typescript
async function initializeEditor(template: Template): Promise<void> {
  // 1. Load template into Zustand store
  templateStore.loadTemplate(template);

  // 2. Set canvas dimensions
  canvas.setDimensions(template.width, template.height);

  // 3. Render elements on canvas
  for (const element of template.elements) {
    await renderElement(element);
  }

  // 4. Initialize history tracking
  historyManager.initialize(template);

  // 5. Set up auto-save if enabled
  if (userPreferences.autoSave) {
    autoSaveManager.start(template.id);
  }

  // 6. Update UI state
  ui.setTemplateLoaded(true);
  ui.setTemplateName(template.name);
  ui.setProjectName(template.project.name);
}
```

## UI Components

### Open Dialog

```tsx
interface OpenDialogProps {
  open: boolean;
  onClose: () => void;
  onOpen: (templateId: string) => Promise<void>;
}

const OpenTemplateDialog: React.FC<OpenDialogProps> = ({
  open,
  onClose,
  onOpen
}) => {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="h6">Open Template</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Search and Filters */}
        <Box mb={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon />
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <ProjectSelect
                value={selectedProject}
                onChange={setSelectedProject}
                includeAll
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, v) => v && setViewMode(v)}
              >
                <ToggleButton value="grid">
                  <GridViewIcon />
                </ToggleButton>
                <ToggleButton value="list">
                  <ListViewIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Box>

        {/* Template List */}
        {loading ? (
          <TemplateListSkeleton />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<FolderOpenIcon />}
            title="No templates found"
            description="Create your first template to get started"
          />
        ) : viewMode === 'grid' ? (
          <TemplateGrid
            templates={filteredTemplates}
            onSelect={handleOpen}
          />
        ) : (
          <TemplateList
            templates={filteredTemplates}
            onSelect={handleOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
```

### Template Grid View

```tsx
const TemplateGrid: React.FC<{
  templates: TemplateListItem[];
  onSelect: (id: string) => void;
}> = ({ templates, onSelect }) => {
  return (
    <Grid container spacing={2}>
      {templates.map((template) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
          <TemplateCard
            template={template}
            onClick={() => onSelect(template.id)}
          />
        </Grid>
      ))}
    </Grid>
  );
};

const TemplateCard: React.FC<{
  template: TemplateListItem;
  onClick: () => void;
}> = ({ template, onClick }) => {
  return (
    <Card
      sx={{
        cursor: 'pointer',
        '&:hover': { boxShadow: 4 }
      }}
      onClick={onClick}
    >
      <CardMedia
        component="img"
        height="180"
        image={template.thumbnailUrl || '/placeholder-template.png'}
        alt={template.name}
      />
      <CardContent>
        <Typography variant="h6" noWrap>
          {template.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {template.projectName}
        </Typography>
        <Box display="flex" justifyContent="space-between" mt={1}>
          <Typography variant="caption">
            {template.width} × {template.height}
          </Typography>
          <Typography variant="caption">
            {formatRelative(template.updatedAt)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
```

### Recent Templates Panel

```tsx
const RecentTemplates: React.FC = () => {
  const [recent, setRecent] = useState<TemplateListItem[]>([]);

  useEffect(() => {
    fetchRecentTemplates().then(setRecent);
  }, []);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Recent Templates
      </Typography>
      <List>
        {recent.map((template) => (
          <ListItem
            key={template.id}
            button
            onClick={() => openTemplate(template.id)}
          >
            <ListItemIcon>
              <ArticleIcon />
            </ListItemIcon>
            <ListItemText
              primary={template.name}
              secondary={formatRelative(template.lastAccessedAt)}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
```

## Resource Loading Strategy with Fallback Cascade

### Mode-Aware Resource Loading

```typescript
interface ResourceLoadStrategy {
  mode: 'full' | 'fallback' | 'local';
  sources: ResourceSource[];
  cacheFirst: boolean;
}

interface ResourceSource {
  type: 'seaweedfs' | 'local-storage' | 'browser-cache';
  url: string;
  priority: number; // 0 = highest priority
}
```

### Resource Loading with Fallback Cascade

```typescript
class HarmoniousResourceLoader {
  private mode: OpenMode;
  private cacheManager: CacheManager;

  async loadResource(resourceId: string): Promise<Blob> {
    // 1. Always check browser cache first
    const cached = await this.cacheManager.get(resourceId);
    if (cached && !this.isCacheExpired(cached)) {
      return cached.data;
    }

    // 2. Load based on current mode
    switch (this.mode) {
      case OpenMode.FULL:
        return this.loadWithFallback([
          () => this.loadFromSeaweedFS(resourceId),
          () => this.loadFromLocalStorage(resourceId),
          () => this.loadFromBrowserCache(resourceId, true) // expired ok
        ]);

      case OpenMode.FALLBACK:
        return this.loadWithFallback([
          () => this.loadFromLocalStorage(resourceId),
          () => this.loadFromBrowserCache(resourceId, true)
        ]);

      case OpenMode.LOCAL_ONLY:
        return this.loadFromBrowserCache(resourceId, true);
    }
  }

  private async loadWithFallback(loaders: Array<() => Promise<Blob>>): Promise<Blob> {
    for (const loader of loaders) {
      try {
        const result = await loader();
        if (result) {
          // Cache successful load
          await this.cacheManager.set(resourceId, result);
          return result;
        }
      } catch (error) {
        console.warn('Resource load failed, trying next:', error);
        continue;
      }
    }
    throw new Error('All resource load attempts failed');
  }

  private async loadFromSeaweedFS(resourceId: string): Promise<Blob> {
    const { userId } = await authService.getUserContext();
    const url = `${SEAWEEDFS_URL}/resources/${userId}/${resourceId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await authService.getToken()}` }
    });
    if (!response.ok) throw new Error(`S3 load failed: ${response.status}`);
    return await response.blob();
  }

  private async loadFromLocalStorage(resourceId: string): Promise<Blob> {
    const { userId } = await authService.getUserContext();
    const url = `/api/storage/local/resources/${userId}/${resourceId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Local storage load failed: ${response.status}`);
    return await response.blob();
  }

  private async loadFromBrowserCache(resourceId: string, allowExpired = false): Promise<Blob> {
    const cached = await browserStorage.getResource(resourceId);
    if (!cached) throw new Error('Not in browser cache');
    if (!allowExpired && this.isCacheExpired(cached)) {
      throw new Error('Cache expired');
    }
    return cached.data;
  }
}
```

### Priority-Based Lazy Loading with Cache

```typescript
interface ResourcePriority {
  critical: string[];   // Load before showing UI (logos, headers)
  high: string[];       // Load immediately (visible elements)
  medium: string[];     // Load after high priority
  low: string[];        // Load on demand
  deferred: string[];   // Load only when needed
}

class LazyResourceLoader {
  private queue: PriorityQueue<ResourceLoadTask>;
  private loading = new Map<string, Promise<Blob>>();
  private loaded = new Set<string>();
  private harmoniousLoader: HarmoniousResourceLoader;

  constructor() {
    this.queue = new PriorityQueue();
    this.harmoniousLoader = new HarmoniousResourceLoader();
  }

  async loadResources(template: Template): Promise<void> {
    const priorities = this.prioritizeResources(template);

    // 1. Load critical resources synchronously
    await Promise.all(
      priorities.critical.map(id => this.loadResource(id, 'critical'))
    );

    // 2. Load high priority in parallel (max 3)
    const highPromises = priorities.high.map(id =>
      this.loadResource(id, 'high')
    );

    // 3. Queue medium and low priority
    priorities.medium.forEach(id => this.queueResource(id, 'medium'));
    priorities.low.forEach(id => this.queueResource(id, 'low'));

    // 4. Start background processing
    this.startBackgroundLoading();

    // Wait for high priority to complete
    await Promise.all(highPromises);
  }

  private prioritizeResources(template: Template): ResourcePriority {
    const priority: ResourcePriority = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      deferred: []
    };

    for (const element of template.elements) {
      if (!element.resourceUrl) continue;

      if (element.critical) {
        priority.critical.push(element.resourceUrl);
      } else if (element.visible && this.isInViewport(element)) {
        priority.high.push(element.resourceUrl);
      } else if (element.visible) {
        priority.medium.push(element.resourceUrl);
      } else if (element.preload) {
        priority.low.push(element.resourceUrl);
      } else {
        priority.deferred.push(element.resourceUrl);
      }
    }

    return priority;
  }

  private async loadResource(
    resourceId: string,
    priority: 'critical' | 'high' | 'medium' | 'low'
  ): Promise<Blob> {
    // Check if already loading
    if (this.loading.has(resourceId)) {
      return this.loading.get(resourceId)!;
    }

    // Check if already loaded
    if (this.loaded.has(resourceId)) {
      return this.harmoniousLoader.getCached(resourceId);
    }

    // Start loading
    const loadPromise = this.harmoniousLoader.loadResource(resourceId);
    this.loading.set(resourceId, loadPromise);

    try {
      const blob = await loadPromise;
      this.loaded.add(resourceId);
      this.loading.delete(resourceId);
      return blob;
    } catch (error) {
      this.loading.delete(resourceId);
      throw error;
    }
  }

  private async startBackgroundLoading() {
    while (!this.queue.isEmpty()) {
      // Process up to 3 resources in parallel
      const batch = [];
      for (let i = 0; i < 3 && !this.queue.isEmpty(); i++) {
        const task = this.queue.dequeue();
        if (task) {
          batch.push(this.loadResource(task.resourceId, task.priority));
        }
      }

      await Promise.allSettled(batch);

      // Small delay to prevent blocking UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

## Error Handling

### Network Errors

```typescript
async function handleNetworkError(error: Error): Promise<void> {
  if (error.message.includes('Network')) {
    showNotification({
      type: 'error',
      message: 'Unable to load template. Check your connection.',
      action: {
        label: 'Retry',
        onClick: retryLoad
      }
    });

    // Try to load from cache if available
    const cached = await browserStorage.getCachedTemplate(templateId);
    if (cached) {
      showNotification({
        type: 'info',
        message: 'Loading cached version'
      });
      return loadCachedTemplate(cached);
    }
  }
}
```

### Permission Errors

```typescript
async function handlePermissionError(error: ForbiddenError): Promise<void> {
  showDialog({
    title: 'Access Denied',
    message: 'You do not have permission to open this template.',
    actions: [
      {
        label: 'Request Access',
        onClick: () => requestAccess(templateId)
      },
      {
        label: 'OK',
        onClick: closeDialog
      }
    ]
  });
}
```

### Corrupted Data

```typescript
async function handleCorruptedTemplate(error: Error): Promise<void> {
  console.error('Template data corrupted:', error);

  const result = await showDialog({
    title: 'Template Error',
    message: 'This template appears to be corrupted.',
    actions: [
      {
        label: 'Restore from Backup',
        onClick: () => restoreFromBackup(templateId)
      },
      {
        label: 'Create New',
        onClick: createNewTemplate
      }
    ]
  });
}
```

## Performance Optimizations

### Template Metadata Caching

```typescript
class TemplateMetadataCache {
  private cache = new Map<string, CachedMetadata>();
  private maxAge = 5 * 60 * 1000; // 5 minutes

  async get(templateId: string): Promise<TemplateMetadata | null> {
    const cached = this.cache.get(templateId);

    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.data;
    }

    return null;
  }

  set(templateId: string, metadata: TemplateMetadata): void {
    this.cache.set(templateId, {
      data: metadata,
      timestamp: Date.now()
    });
  }

  invalidate(templateId: string): void {
    this.cache.delete(templateId);
  }
}
```

### Thumbnail Generation

```typescript
async function generateThumbnail(template: Template): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Set thumbnail dimensions (maintain aspect ratio)
  const maxSize = 400;
  const scale = Math.min(maxSize / template.width, maxSize / template.height);
  canvas.width = template.width * scale;
  canvas.height = template.height * scale;

  // Render template at reduced scale
  ctx.scale(scale, scale);
  await renderTemplateToCanvas(template, ctx);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.8);
  });

  // Upload to S3
  const url = await uploadThumbnail(template.id, blob);

  return url;
}
```

## Security Considerations

### Access Control

```typescript
// Middleware for template access
async function templateAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { templateId } = req.params;
  const userId = req.user.id;

  try {
    const permission = await checkTemplateAccess(userId, templateId);
    req.templatePermission = permission;
    next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      res.status(403).json({ error: 'Access denied' });
    } else {
      next(error);
    }
  }
}
```

### Rate Limiting

```typescript
const openTemplateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 opens per minute
  message: 'Too many template opens, please try again later'
});

router.get('/templates/:id', [
  authMiddleware,
  openTemplateLimiter,
  templateAccessMiddleware
], loadTemplate);
```

## Migration from Old System

### Detecting Old Format

```typescript
function isOldFormat(data: any): boolean {
  // Check for old format indicators
  return (
    !data.version ||
    data.version < 2 ||
    !data.metadata ||
    data.elements?.[0]?.localResourcePath
  );
}
```

### Migration Process

```typescript
async function migrateOldTemplate(oldData: any): Promise<Template> {
  const migrated: Template = {
    id: oldData.id || generateId(),
    name: oldData.name,
    version: 2,
    width: oldData.width,
    height: oldData.height,
    elements: await migrateElements(oldData.elements),
    metadata: {
      createdAt: oldData.createdAt || new Date(),
      updatedAt: new Date(),
      migrated: true,
      originalVersion: oldData.version || 1
    }
  };

  // Upload migrated template
  await saveTemplate(migrated);

  return migrated;
}
```

## Testing Requirements

### Unit Tests

```typescript
describe('Template Open Service', () => {
  test('should check permissions before loading', async () => {
    const spy = jest.spyOn(permissionService, 'check');
    await openTemplate('template-123');
    expect(spy).toHaveBeenCalledWith('template-123', 'read');
  });

  test('should clear previous state before loading', async () => {
    const clearSpy = jest.spyOn(browserStorage, 'clear');
    await openTemplate('template-123');
    expect(clearSpy).toHaveBeenCalled();
  });

  test('should handle missing templates gracefully', async () => {
    await expect(openTemplate('non-existent')).rejects.toThrow(NotFoundError);
  });
});
```

### Integration Tests

```typescript
describe('Template Open Flow', () => {
  test('complete open flow from dialog to canvas', async () => {
    // 1. Open dialog
    const dialog = render(<OpenTemplateDialog />);

    // 2. Select template
    const templateCard = await dialog.findByText('My Template');
    fireEvent.click(templateCard);

    // 3. Verify loading
    await waitFor(() => {
      expect(canvas.getElements()).toHaveLength(5);
    });

    // 4. Verify state
    expect(templateStore.currentTemplate?.id).toBe('template-123');
  });
});
```

## Success Metrics

### Performance Metrics
- Template list load time < 500ms (p95)
- Template open time < 1 second (p95)
- Resource load time < 200ms per resource
- Thumbnail generation < 100ms

### Reliability Metrics
- Successful open rate > 99.9%
- Permission check accuracy = 100%
- Resource load success > 99%

### User Experience Metrics
- Time to first paint < 300ms
- Time to interactive < 1 second
- Search response time < 100ms

## Implementation Checklist

- [ ] Database schema for template metadata
- [ ] API endpoint for listing templates
- [ ] API endpoint for loading template
- [ ] Permission checking system
- [ ] Open dialog UI component
- [ ] Template grid/list views
- [ ] Search and filter functionality
- [ ] Recent templates tracking
- [ ] Resource loading system
- [ ] Lazy loading implementation
- [ ] Browser storage integration
- [ ] Canvas initialization
- [ ] Error handling
- [ ] Loading states
- [ ] Thumbnail generation
- [ ] Caching system
- [ ] Migration from old format
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance monitoring
- [ ] Documentation
