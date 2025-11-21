# Template Storage Implementation Plan

**Project**: E-Cards Template-Textile Feature
**Date**: 2025-01-20
**Version**: 2.0 - Balanced Integration with Graceful Degradation

## Executive Summary

This document outlines a comprehensive implementation plan for a harmoniously balanced template storage architecture that supports THREE operational modes with graceful degradation. The system seamlessly integrates SeaweedFS (S3), PostgreSQL, Cassandra, browser storage, and a `.local-storage` fallback directory, ensuring the application works in all scenarios - from fully authenticated with all services available to completely offline mode.

## Core Architecture Principles

### Three Operational Modes

1. **FULL MODE** (Authenticated + SeaweedFS Available)
   - All services operational
   - SeaweedFS for resources and template JSON
   - PostgreSQL for normalized data
   - Cassandra for events/metadata
   - Browser cache for performance

2. **FALLBACK MODE** (Authenticated + SeaweedFS Unavailable)
   - Authentication working but SeaweedFS down
   - `.local-storage` directory as fallback
   - PostgreSQL and Cassandra still operational
   - Browser cache for performance

3. **LOCAL-ONLY MODE** (Not Authenticated)
   - No server-side operations
   - Browser IndexedDB/localStorage only
   - Full offline capability
   - No database access

### Graceful Degradation Strategy

```typescript
// Mode detection logic
enum StorageMode {
  FULL = 'full',
  FALLBACK = 'fallback',
  LOCAL_ONLY = 'local_only'
}

async function detectStorageMode(): Promise<StorageMode> {
  // Check authentication
  const isAuthenticated = await authService.isAuthenticated()
  if (!isAuthenticated) {
    return StorageMode.LOCAL_ONLY
  }

  // Check SeaweedFS availability
  const isSeaweedFSAvailable = await checkSeaweedFSHealth()
  if (!isSeaweedFSAvailable) {
    return StorageMode.FALLBACK
  }

  return StorageMode.FULL
}
```

## Implementation Phases

### Phase 1: Multi-Mode Infrastructure (Week 1)

#### 1.1 PostgreSQL Schema Design (Normalized Data)
**Priority**: Critical
**Timeline**: 2 days

```prisma
model Template {
  id            String   @id @default(uuid())
  userId        String   @map("user_id")
  projectId     String   @map("project_id")
  name          String
  width         Int
  height        Int
  exportWidth   Int      @map("export_width")
  storageUrl    String   @map("storage_url") // S3 URL or local path
  storageMode   String   @map("storage_mode") // 'seaweedfs' | 'local'
  elementCount  Int      @default(0) @map("element_count")
  thumbnailUrl  String?  @map("thumbnail_url")
  isPublic      Boolean  @default(false) @map("is_public")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  user          User                @relation(fields: [userId], references: [id])
  project       Project            @relation(fields: [projectId], references: [id])
  resources     TemplateResource[]
  versions      TemplateVersion[]
  shares        TemplateShare[]

  @@unique([userId, projectId, name])
  @@index([userId])
  @@index([projectId])
  @@index([storageMode])
  @@map("templates")
}

model TemplateResource {
  id           String   @id @default(uuid())
  templateId   String   @map("template_id")
  name         String
  type         ResourceType
  storageUrl   String   @map("storage_url") // S3 URL or local path
  storageMode  String   @map("storage_mode") // 'seaweedfs' | 'local'
  hash         String   // Content hash for deduplication
  size         Int
  mimeType     String   @map("mime_type")
  createdAt    DateTime @default(now()) @map("created_at")

  template     Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([hash])
  @@index([templateId])
  @@index([storageMode])
  @@map("template_resources")
}

enum ResourceType {
  IMAGE
  FONT
  SVG
  VIDEO
  AUDIO
}
```

#### 1.2 Cassandra Schema (Canonical Metadata & Events)
**Priority**: High
**Timeline**: 1 day

```cql
-- Large metadata and event logs
CREATE TABLE IF NOT EXISTS ecards_canonical.template_metadata (
    template_id UUID,
    user_id UUID,
    full_metadata TEXT, -- Large JSON blob
    event_history TEXT, -- Complete event log
    audit_trail TEXT,   -- Audit information
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY ((template_id), user_id)
);

CREATE TABLE IF NOT EXISTS ecards_canonical.template_events (
    user_id UUID,
    template_id UUID,
    event_id TIMEUUID,
    event_type TEXT,
    storage_mode TEXT, -- 'full' | 'fallback' | 'local'
    event_data TEXT,   -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY ((user_id, template_id), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

CREATE INDEX ON ecards_canonical.template_events (storage_mode);
CREATE INDEX ON ecards_canonical.template_events (event_type);
```

#### 1.3 Browser Storage Service (IndexedDB) - Enhanced
**Priority**: Critical
**Timeline**: 2 days

```typescript
// front-cards/features/template-textile/services/browserStorageService.ts

interface BrowserStorageService {
  // Mode management
  getCurrentMode(): Promise<StorageMode>
  setMode(mode: StorageMode): Promise<void>

  // Template operations (works in all modes)
  saveTemplate(template: Template): Promise<void>
  getTemplate(id: string): Promise<Template | null>
  listTemplates(): Promise<TemplateMetadata[]>
  deleteTemplate(id: string): Promise<void>

  // Resource operations
  cacheResource(key: string, data: Blob): Promise<void>
  getResource(key: string): Promise<Blob | null>
  clearResourceCache(): Promise<void>

  // Sync queue (for when returning to FULL/FALLBACK mode)
  addToSyncQueue(item: SyncQueueItem): Promise<void>
  getSyncQueue(): Promise<SyncQueueItem[]>
  processSyncQueue(): Promise<void>

  // Storage management
  getStorageUsage(): Promise<StorageUsage>
  pruneCache(maxAge?: number): Promise<number>
}

class HarmoniousBrowserStorage implements BrowserStorageService {
  private db: Dexie
  private mode: StorageMode

  constructor() {
    this.db = new Dexie('TemplateStorage')
    this.db.version(2).stores({
      templates: 'id, userId, projectId, updatedAt, syncStatus',
      resources: 'key, hash, createdAt, lastAccessedAt',
      syncQueue: 'id, type, status, createdAt, retries',
      settings: 'key, value'
    })
  }

  async saveTemplate(template: Template): Promise<void> {
    const mode = await this.getCurrentMode()

    switch (mode) {
      case StorageMode.FULL:
        // Save to browser cache temporarily
        await this.db.templates.put({ ...template, syncStatus: 'pending' })
        // Trigger server save (will save to SeaweedFS + PostgreSQL + Cassandra)
        await this.triggerServerSave(template)
        break

      case StorageMode.FALLBACK:
        // Save to browser cache
        await this.db.templates.put({ ...template, syncStatus: 'pending' })
        // Trigger server save (will save to .local-storage + PostgreSQL + Cassandra)
        await this.triggerFallbackSave(template)
        break

      case StorageMode.LOCAL_ONLY:
        // Save only to browser storage
        await this.db.templates.put({ ...template, syncStatus: 'local' })
        // Add to sync queue for when authenticated
        await this.addToSyncQueue({
          type: 'TEMPLATE_SAVE',
          data: template,
          createdAt: new Date()
        })
        break
    }
  }
}
```

#### 1.4 Fallback Storage Service (.local-storage)
**Priority**: Critical
**Timeline**: 2 days

```typescript
// api-server/src/features/template-textile/services/fallbackStorageService.ts

class FallbackStorageService {
  private basePath = '.local-storage'

  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.basePath, fs.constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  async saveTemplate(userId: string, template: Template): Promise<string> {
    const path = `${this.basePath}/users/${userId}/templates/${template.id}`
    await fs.mkdir(path, { recursive: true })

    const templatePath = `${path}/template.json`
    await fs.writeFile(templatePath, JSON.stringify(template))

    return templatePath
  }

  async saveResource(userId: string, resource: Buffer, hash: string): Promise<string> {
    const path = `${this.basePath}/users/${userId}/resources/${hash}`
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(path, resource)
    return path
  }

  async getTemplate(userId: string, templateId: string): Promise<Template | null> {
    try {
      const path = `${this.basePath}/users/${userId}/templates/${templateId}/template.json`
      const data = await fs.readFile(path, 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  async getResource(userId: string, hash: string): Promise<Buffer | null> {
    try {
      const path = `${this.basePath}/users/${userId}/resources/${hash}`
      return await fs.readFile(path)
    } catch {
      return null
    }
  }
}
```

### Phase 2: Harmonious Storage Flow Implementation (Week 2)

#### 2.1 Unified Save Flow with Mode Detection
**Priority**: Critical
**Timeline**: 3 days

```typescript
// api-server/src/features/template-textile/services/unifiedSaveService.ts

class UnifiedSaveService {
  async saveTemplate(request: SaveTemplateRequest): Promise<SaveTemplateResponse> {
    const { template, resources, projectId, userId } = request

    // Detect current storage mode
    const mode = await this.detectStorageMode()

    let savedTemplate: SavedTemplate

    switch (mode) {
      case StorageMode.FULL:
        savedTemplate = await this.saveFullMode(template, resources, userId, projectId)
        break

      case StorageMode.FALLBACK:
        savedTemplate = await this.saveFallbackMode(template, resources, userId, projectId)
        break

      case StorageMode.LOCAL_ONLY:
        // Should not reach here - LOCAL_ONLY is handled client-side
        throw new Error('Cannot save to server in LOCAL_ONLY mode')
    }

    // Always update PostgreSQL (normalized data)
    await this.updatePostgreSQL(savedTemplate, mode)

    // Always log to Cassandra (events and large metadata)
    await this.logToCassandra(savedTemplate, mode)

    return {
      success: true,
      templateId: savedTemplate.id,
      storageMode: mode,
      storageUrl: savedTemplate.storageUrl
    }
  }

  private async saveFullMode(
    template: Template,
    resources: Resource[],
    userId: string,
    projectId: string
  ): Promise<SavedTemplate> {
    // Upload resources to SeaweedFS (as separate objects)
    const uploadedResources = await Promise.all(
      resources.map(async (r) => {
        const s3Key = `resources/${r.hash}/${r.name}`
        const url = await this.s3Service.upload(s3Key, r.data)
        return { ...r, url }
      })
    )

    // Update template with resource URLs
    const updatedTemplate = this.replaceResourceUrls(template, uploadedResources)

    // Save template JSON to SeaweedFS
    const templateKey = `templates/${userId}/${projectId}/${template.id}/template.json`
    const templateUrl = await this.s3Service.upload(templateKey, JSON.stringify(updatedTemplate))

    return {
      id: template.id,
      storageUrl: templateUrl,
      storageMode: 'seaweedfs',
      resources: uploadedResources
    }
  }

  private async saveFallbackMode(
    template: Template,
    resources: Resource[],
    userId: string,
    projectId: string
  ): Promise<SavedTemplate> {
    // Save resources to .local-storage
    const savedResources = await Promise.all(
      resources.map(async (r) => {
        const path = await this.fallbackStorage.saveResource(userId, r.data, r.hash)
        return { ...r, url: path }
      })
    )

    // Update template with local paths
    const updatedTemplate = this.replaceResourceUrls(template, savedResources)

    // Save template JSON to .local-storage
    const templatePath = await this.fallbackStorage.saveTemplate(userId, updatedTemplate)

    return {
      id: template.id,
      storageUrl: templatePath,
      storageMode: 'local',
      resources: savedResources
    }
  }

  private async updatePostgreSQL(template: SavedTemplate, mode: StorageMode) {
    await prisma.template.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        storageUrl: template.storageUrl,
        storageMode: mode,
        // ... other fields
      },
      update: {
        storageUrl: template.storageUrl,
        storageMode: mode,
        updatedAt: new Date()
      }
    })

    // Save resources
    for (const resource of template.resources) {
      await prisma.templateResource.create({
        templateId: template.id,
        storageUrl: resource.url,
        storageMode: mode,
        hash: resource.hash,
        // ... other fields
      })
    }
  }

  private async logToCassandra(template: SavedTemplate, mode: StorageMode) {
    // Log event
    await cassandra.execute(
      `INSERT INTO template_events (user_id, template_id, event_id, event_type, storage_mode, event_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        template.userId,
        template.id,
        TimeUuid.now(),
        'TEMPLATE_SAVED',
        mode,
        JSON.stringify(template),
        new Date()
      ]
    )

    // Save large metadata
    await cassandra.execute(
      `INSERT INTO template_metadata (template_id, user_id, full_metadata, updated_at)
       VALUES (?, ?, ?, ?)`,
      [
        template.id,
        template.userId,
        JSON.stringify(template),
        new Date()
      ]
    )
  }
}
```

#### 2.2 Unified Open Flow with Cascade Loading
**Priority**: Critical
**Timeline**: 2 days

```typescript
// api-server/src/features/template-textile/services/unifiedOpenService.ts

class UnifiedOpenService {
  async openTemplate(templateId: string, userId: string): Promise<OpenTemplateResponse> {
    // Check permissions
    const hasAccess = await this.checkPermission(userId, templateId)
    if (!hasAccess) throw new ForbiddenError()

    // Get metadata from PostgreSQL
    const metadata = await prisma.template.findUnique({
      where: { id: templateId },
      include: { resources: true }
    })

    if (!metadata) throw new NotFoundError()

    // Detect current mode and load accordingly
    const mode = await this.detectStorageMode()
    let template: Template

    // Try to load based on storage mode recorded in database
    if (metadata.storageMode === 'seaweedfs') {
      template = await this.loadFromSeaweedFS(metadata)

      // If SeaweedFS fails, fall back to local storage
      if (!template && await this.fallbackStorage.isAvailable()) {
        template = await this.loadFromFallback(userId, templateId)
      }
    } else if (metadata.storageMode === 'local') {
      template = await this.loadFromFallback(userId, templateId)
    }

    if (!template) {
      throw new Error('Template not found in any storage location')
    }

    // Load resources with intelligent caching
    const resources = await this.loadResources(metadata.resources, userId, mode)

    // Log access event to Cassandra
    await this.logAccess(templateId, userId, mode)

    return {
      template,
      resources,
      metadata,
      storageMode: mode
    }
  }

  private async loadResources(
    resourceMeta: ResourceMetadata[],
    userId: string,
    mode: StorageMode
  ): Promise<LoadedResource[]> {
    return Promise.all(
      resourceMeta.map(async (meta) => {
        // Try browser cache first
        const cached = await this.browserCache.get(meta.hash)
        if (cached) return { ...meta, data: cached, source: 'cache' }

        // Try primary storage
        let data: Buffer | null = null

        if (meta.storageMode === 'seaweedfs') {
          try {
            data = await this.s3Service.download(meta.storageUrl)
          } catch (error) {
            console.warn('Failed to load from SeaweedFS, trying fallback', error)
          }
        }

        // Try fallback storage
        if (!data && await this.fallbackStorage.isAvailable()) {
          data = await this.fallbackStorage.getResource(userId, meta.hash)
        }

        if (!data) {
          console.error(`Resource ${meta.hash} not found in any storage`)
          return { ...meta, data: null, source: 'missing' }
        }

        // Cache for future use
        await this.browserCache.set(meta.hash, data)

        return { ...meta, data, source: meta.storageMode }
      })
    )
  }
}
```

### Phase 3: Authentication Integration & Mode Switching (Week 3)

#### 3.1 Authentication Context Service
**Priority**: Critical
**Timeline**: 2 days

```typescript
// front-cards/features/template-textile/services/authContextService.ts

class AuthContextService {
  private currentMode: StorageMode = StorageMode.LOCAL_ONLY
  private userId: string | null = null
  private username: string | null = null

  async initialize() {
    // Check authentication status
    const authStatus = await this.checkAuthStatus()

    if (authStatus.isAuthenticated) {
      this.userId = authStatus.userId
      this.username = authStatus.username

      // Check SeaweedFS availability
      const seaweedfsAvailable = await this.checkSeaweedFS()

      this.currentMode = seaweedfsAvailable
        ? StorageMode.FULL
        : StorageMode.FALLBACK

      // Process any pending sync queue items
      await this.processPendingSyncs()
    } else {
      this.currentMode = StorageMode.LOCAL_ONLY
      this.userId = null
      this.username = null
    }

    // Set up mode monitoring
    this.startModeMonitoring()
  }

  private async checkAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch('/api/auth/user')
      if (response.ok) {
        const user = await response.json()
        return {
          isAuthenticated: true,
          userId: user.id,
          username: user.username
        }
      }
    } catch (error) {
      console.warn('Auth check failed:', error)
    }

    return { isAuthenticated: false }
  }

  private async checkSeaweedFS(): Promise<boolean> {
    try {
      const response = await fetch('/api/storage/health')
      const data = await response.json()
      return data.seaweedfs === 'healthy'
    } catch {
      return false
    }
  }

  private startModeMonitoring() {
    // Monitor for mode changes every 30 seconds
    setInterval(async () => {
      const previousMode = this.currentMode
      await this.initialize()

      if (previousMode !== this.currentMode) {
        await this.handleModeChange(previousMode, this.currentMode)
      }
    }, 30000)
  }

  private async handleModeChange(from: StorageMode, to: StorageMode) {
    console.log(`Storage mode changed: ${from} → ${to}`)

    // If moving from LOCAL_ONLY to authenticated mode, sync local data
    if (from === StorageMode.LOCAL_ONLY && to !== StorageMode.LOCAL_ONLY) {
      await this.syncLocalTemplates()
    }

    // Notify UI components of mode change
    window.dispatchEvent(new CustomEvent('storage-mode-changed', {
      detail: { from, to }
    }))
  }

  private async syncLocalTemplates() {
    const syncQueue = await browserStorage.getSyncQueue()

    for (const item of syncQueue) {
      try {
        if (item.type === 'TEMPLATE_SAVE') {
          await this.syncTemplate(item.data)
        }

        await browserStorage.removeFromSyncQueue(item.id)
      } catch (error) {
        console.error('Failed to sync item:', item.id, error)
      }
    }
  }

  getUserContext(): UserContext | null {
    if (!this.userId) return null

    return {
      userId: this.userId,
      username: this.username,
      mode: this.currentMode
    }
  }
}
```

#### 3.2 UI Mode Indicators
**Priority**: High
**Timeline**: 1 day

```tsx
// front-cards/features/template-textile/components/StorageModeIndicator.tsx

const StorageModeIndicator: React.FC = () => {
  const [mode, setMode] = useState<StorageMode>(StorageMode.LOCAL_ONLY)
  const [syncPending, setSyncPending] = useState(0)

  useEffect(() => {
    const updateMode = async () => {
      const currentMode = await authContextService.getCurrentMode()
      setMode(currentMode)

      if (currentMode === StorageMode.LOCAL_ONLY) {
        const queue = await browserStorage.getSyncQueue()
        setSyncPending(queue.length)
      }
    }

    updateMode()

    // Listen for mode changes
    window.addEventListener('storage-mode-changed', updateMode)
    return () => window.removeEventListener('storage-mode-changed', updateMode)
  }, [])

  return (
    <Box display="flex" alignItems="center" gap={1} p={1}>
      {mode === StorageMode.FULL && (
        <Chip
          icon={<CloudDoneIcon />}
          label="Cloud Storage"
          color="success"
          size="small"
        />
      )}

      {mode === StorageMode.FALLBACK && (
        <Chip
          icon={<CloudOffIcon />}
          label="Local Fallback"
          color="warning"
          size="small"
          title="Cloud storage unavailable, using local fallback"
        />
      )}

      {mode === StorageMode.LOCAL_ONLY && (
        <>
          <Chip
            icon={<OfflineBoltIcon />}
            label="Offline Mode"
            color="default"
            size="small"
          />
          {syncPending > 0 && (
            <Chip
              label={`${syncPending} pending sync`}
              color="info"
              size="small"
              variant="outlined"
            />
          )}
        </>
      )}
    </Box>
  )
}
```

### Phase 4: Resource Management & Deduplication (Week 4)

#### 4.1 Resource Deduplication Service
**Priority**: High
**Timeline**: 2 days

```typescript
// api-server/src/features/template-textile/services/resourceDeduplicationService.ts

class ResourceDeduplicationService {
  async processResource(
    resource: UploadedResource,
    userId: string
  ): Promise<ProcessedResource> {
    // Calculate content hash
    const hash = await this.calculateHash(resource.buffer)

    // Check if resource already exists (by hash)
    const existing = await prisma.templateResource.findFirst({
      where: { hash }
    })

    if (existing) {
      // Resource already exists, return existing URL
      return {
        url: existing.storageUrl,
        hash,
        deduplicated: true,
        storageMode: existing.storageMode
      }
    }

    // New resource, determine storage location
    const mode = await this.detectStorageMode()
    let storageUrl: string

    if (mode === StorageMode.FULL) {
      // Store in SeaweedFS
      const s3Key = `resources/${hash}/${resource.name}`
      storageUrl = await this.s3Service.upload(s3Key, resource.buffer, {
        contentType: resource.mimeType,
        metadata: { hash, originalName: resource.name }
      })
    } else {
      // Store in .local-storage
      storageUrl = await this.fallbackStorage.saveResource(
        userId,
        resource.buffer,
        hash
      )
    }

    // Record in database
    await prisma.templateResource.create({
      data: {
        name: resource.name,
        type: resource.type,
        storageUrl,
        storageMode: mode === StorageMode.FULL ? 'seaweedfs' : 'local',
        hash,
        size: resource.buffer.length,
        mimeType: resource.mimeType
      }
    })

    return {
      url: storageUrl,
      hash,
      deduplicated: false,
      storageMode: mode === StorageMode.FULL ? 'seaweedfs' : 'local'
    }
  }

  private async calculateHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex')
  }
}
```

## Testing Strategy

### Mode-Specific Test Scenarios

```typescript
describe('Multi-Mode Storage System', () => {
  describe('FULL MODE', () => {
    beforeEach(() => {
      mockAuth({ isAuthenticated: true })
      mockSeaweedFS({ available: true })
    })

    test('saves to SeaweedFS and all databases', async () => {})
    test('loads from SeaweedFS with caching', async () => {})
    test('deduplicates resources', async () => {})
  })

  describe('FALLBACK MODE', () => {
    beforeEach(() => {
      mockAuth({ isAuthenticated: true })
      mockSeaweedFS({ available: false })
    })

    test('saves to .local-storage and databases', async () => {})
    test('loads from .local-storage', async () => {})
    test('transitions from FULL mode gracefully', async () => {})
  })

  describe('LOCAL_ONLY MODE', () => {
    beforeEach(() => {
      mockAuth({ isAuthenticated: false })
    })

    test('saves to browser storage only', async () => {})
    test('queues templates for sync', async () => {})
    test('syncs when authenticated', async () => {})
  })

  describe('Mode Transitions', () => {
    test('FULL → FALLBACK → LOCAL_ONLY', async () => {})
    test('LOCAL_ONLY → FALLBACK → FULL', async () => {})
    test('handles intermittent failures', async () => {})
  })
})
```

## Migration Strategy

### Preserving .local-storage as Fallback

```typescript
// Migration script - DO NOT DELETE .local-storage
async function setupFallbackStorage() {
  const fallbackPath = '.local-storage'

  // Ensure directory exists and has proper permissions
  await fs.mkdir(fallbackPath, { recursive: true, mode: 0o755 })

  // Create subdirectory structure
  await fs.mkdir(`${fallbackPath}/users`, { recursive: true })
  await fs.mkdir(`${fallbackPath}/temp`, { recursive: true })

  // Set up cleanup for temp directory only
  schedule.scheduleJob('0 0 * * *', async () => {
    await cleanupTempDirectory(`${fallbackPath}/temp`)
  })

  console.log('Fallback storage initialized at:', fallbackPath)
}
```

## Performance Optimizations

### Intelligent Resource Loading

```typescript
class ResourceLoader {
  async loadWithStrategy(resourceId: string): Promise<Resource> {
    // Level 1: Browser memory cache
    const memCached = this.memoryCache.get(resourceId)
    if (memCached) return memCached

    // Level 2: Browser IndexedDB
    const dbCached = await browserStorage.getResource(resourceId)
    if (dbCached) {
      this.memoryCache.set(resourceId, dbCached)
      return dbCached
    }

    // Level 3: CDN (if available)
    if (this.cdnEnabled) {
      const cdnResource = await this.loadFromCDN(resourceId)
      if (cdnResource) {
        await this.cacheResource(resourceId, cdnResource)
        return cdnResource
      }
    }

    // Level 4: Primary storage (SeaweedFS or .local-storage)
    const primaryResource = await this.loadFromPrimary(resourceId)
    if (primaryResource) {
      await this.cacheResource(resourceId, primaryResource)
      return primaryResource
    }

    throw new Error(`Resource ${resourceId} not found`)
  }
}
```

## Monitoring & Observability

### Key Metrics by Mode

```typescript
interface StorageMetrics {
  mode: StorageMode
  saveLatency: number      // ms
  loadLatency: number      // ms
  resourceCacheHitRate: number  // percentage
  failoverCount: number    // number of failovers
  syncQueueSize: number    // items pending sync
  storageUsage: {
    seaweedfs: number      // bytes
    localStorage: number   // bytes
    browserStorage: number // bytes
  }
}
```

## Success Criteria

### Technical Metrics
- **FULL MODE**: Save < 2s (p95), Load < 1s (p95)
- **FALLBACK MODE**: Save < 1.5s (p95), Load < 800ms (p95)
- **LOCAL_ONLY MODE**: Save < 500ms (p95), Load < 300ms (p95)
- **Mode transitions**: < 2s
- **Resource deduplication**: > 30%
- **Zero data loss** across all modes

### User Experience Metrics
- Templates always accessible (100% availability)
- Seamless mode transitions (no user action required)
- Clear mode indicators in UI
- Successful sync rate > 99%
- User satisfaction > 4.5/5

## Timeline Summary

**Total Duration**: 4 weeks

- **Week 1**: Multi-mode infrastructure setup
- **Week 2**: Harmonious storage flow implementation
- **Week 3**: Authentication integration & mode switching
- **Week 4**: Resource management, testing & optimization

## Key Principles

1. **NEVER** assume authentication is available
2. **NEVER** assume SeaweedFS is available
3. **ALWAYS** provide graceful degradation
4. **ALWAYS** preserve `.local-storage` as fallback
5. **NEVER** embed resources in template JSON
6. **ALWAYS** extract userId/username from auth context
7. **MAINTAIN** harmonious balance between all storage layers

## Conclusion

This implementation plan provides a robust, fault-tolerant template storage system that gracefully handles all operational scenarios. The three-mode architecture ensures users can always work with templates, whether fully online, partially connected, or completely offline. The harmonious integration of all storage layers provides optimal performance while maintaining data integrity and availability.