# Storage Strategy: Harmonious Integration Specification

**Created**: 2025-01-20
**Version**: 1.0 - Comprehensive Multi-Layer Storage Strategy
**Purpose**: Define when and how to use each storage layer for optimal system resilience

## Executive Summary

This document defines the harmonious integration strategy for the E-Cards template storage system. The architecture employs multiple storage layers that work together seamlessly, providing graceful degradation, automatic failover, and optimal performance across all operating conditions.

## Core Philosophy

**"Every storage layer has a purpose. None are redundant. All work in harmony."**

The system is designed to:
- Never lose data
- Always remain operational
- Gracefully degrade when services fail
- Automatically recover when services return
- Optimize performance based on conditions

## The Five Storage Layers

### 1. SeaweedFS (S3-Compatible Object Storage)
**Purpose**: Primary persistent storage for production
**When to Use**:
- User is authenticated
- SeaweedFS is healthy and accessible
- Storing finalized templates
- Storing shared resources
- Long-term archival

**What to Store**:
- Template JSON files (never with embedded resources)
- Resource files (images, fonts, assets)
- Generated thumbnails
- Export artifacts
- Version history

### 2. PostgreSQL (Relational Database)
**Purpose**: Normalized metadata and relationships
**When to Use**:
- Always (when authenticated)
- Storing structured data
- Managing relationships
- Querying and filtering
- Access control

**What to Store**:
- Template metadata (id, name, dimensions)
- User-template relationships
- Project associations
- Sharing permissions
- Storage locations (URLs/paths)
- Version metadata

### 3. Cassandra (Distributed NoSQL)
**Purpose**: Event logging and time-series data
**When to Use**:
- Always (when authenticated)
- Logging events
- Tracking access patterns
- Audit trails
- Analytics data

**What to Store**:
- Template access events
- Save/load operations
- Version history events
- Resource upload events
- Storage mode transitions
- Error events

### 4. .local-storage (Server File System)
**Purpose**: Fallback storage when S3 is unavailable
**When to Use**:
- User is authenticated
- SeaweedFS is down or unreachable
- As temporary storage during S3 outages
- For development/testing
- Emergency backup

**What to Store**:
- Everything S3 would store
- Template JSON files
- Resources (with same structure as S3)
- Metadata files
- Queue for S3 sync

### 5. Browser Storage (IndexedDB + LocalStorage)
**Purpose**: Client-side cache and offline support
**When to Use**:
- Always (for caching)
- When not authenticated (LOCAL-ONLY mode)
- For work-in-progress
- Offline editing
- Performance optimization

**What to Store**:
- Working template copies
- Resource cache
- User preferences
- Undo/redo history
- Sync queue
- Authentication tokens (HTTP-only cookies)

## Three Operating Modes

### Mode 1: FULL (Optimal)
**Conditions**:
- ✅ User authenticated
- ✅ SeaweedFS available
- ✅ All services operational

**Storage Flow**:
```
Browser Cache → API Server → SeaweedFS (primary)
                          → PostgreSQL (metadata)
                          → Cassandra (events)
```

**Characteristics**:
- Best performance (CDN + caching)
- Full feature set
- Real-time collaboration
- Version history
- Sharing capabilities

### Mode 2: FALLBACK (Resilient)
**Conditions**:
- ✅ User authenticated
- ❌ SeaweedFS unavailable
- ✅ PostgreSQL/Cassandra operational

**Storage Flow**:
```
Browser Cache → API Server → .local-storage (fallback)
                          → PostgreSQL (metadata)
                          → Cassandra (events)
```

**Characteristics**:
- Continued operation during S3 outage
- Automatic queuing for sync
- No data loss
- Slightly reduced performance
- Limited sharing (local only)

### Mode 3: LOCAL-ONLY (Offline)
**Conditions**:
- ❌ User not authenticated
- ❌ No server access
- ✅ Browser available

**Storage Flow**:
```
Browser Storage (IndexedDB) → Sync Queue
                           → Local Operations Only
```

**Characteristics**:
- Complete offline operation
- No server dependencies
- Limited to local templates
- Automatic sync when authenticated
- No collaboration features

## Mode Detection Logic

```typescript
async function detectStorageMode(): Promise<StorageMode> {
  // Step 1: Authentication Check
  const auth = await authService.getCurrentUser();
  if (!auth.isAuthenticated) {
    return StorageMode.LOCAL_ONLY;
  }

  // Step 2: Service Health Checks
  const health = await checkServiceHealth();

  if (health.seaweedfs.isHealthy) {
    return StorageMode.FULL;
  }

  if (health.apiServer.isHealthy && health.postgres.isHealthy) {
    return StorageMode.FALLBACK;
  }

  // Step 3: Fallback to local even if authenticated
  return StorageMode.LOCAL_ONLY;
}
```

## Fallback Cascades

### Save Operation Cascade
```
Attempt Save → FULL MODE (S3)
    ↓ (fail)
Try FALLBACK MODE (.local-storage)
    ↓ (fail)
Try LOCAL-ONLY MODE (browser)
    ↓ (fail)
Show Error (storage exhausted)
```

### Load Operation Cascade
```
Check Browser Cache (fastest)
    ↓ (miss)
Try FULL MODE (S3)
    ↓ (fail)
Try FALLBACK MODE (.local-storage)
    ↓ (fail)
Try LOCAL-ONLY MODE (browser storage)
    ↓ (fail)
Show Error (template not found)
```

### Resource Loading Cascade
```
Check Browser Cache
    ↓ (miss/expired)
Try CDN (if available)
    ↓ (fail)
Try S3 Direct
    ↓ (fail)
Try .local-storage API
    ↓ (fail)
Try Expired Cache (better than nothing)
    ↓ (fail)
Show Placeholder
```

## Cache Invalidation Strategies

### Browser Cache
**Strategy**: Time-based + Event-based
```typescript
interface CachePolicy {
  maxAge: number;        // 24 hours default
  staleWhileRevalidate: boolean; // true
  invalidateOn: string[]; // ['save', 'delete', 'share']
}
```

**Invalidation Triggers**:
- Template saved (clear working copy)
- Template deleted (remove from cache)
- Resources updated (invalidate specific resources)
- User logout (clear sensitive data)
- Storage quota exceeded (LRU eviction)

### CDN Cache
**Strategy**: Versioned URLs + Purge API
- Template URLs include version: `/templates/{id}/v{version}`
- Resources use content hash: `/resources/{hash}`
- Purge on update via API
- Long cache headers (1 year)

### Server Cache (Redis)
**Strategy**: Write-through + TTL
- Cache on read
- Invalidate on write
- TTL: 1 hour for templates, 24 hours for resources
- Memory limit eviction (LRU)

## Resource Deduplication Logic

### Hash-Based Deduplication
```typescript
async function deduplicateResource(file: File): Promise<ResourceReference> {
  // 1. Calculate content hash
  const hash = await calculateSHA256(file);

  // 2. Check if already exists
  const existing = await findResourceByHash(hash);
  if (existing) {
    return {
      url: existing.url,
      hash: hash,
      deduplicated: true,
      savedBytes: file.size
    };
  }

  // 3. New resource - proceed with upload
  return uploadNewResource(file, hash);
}
```

**Deduplication Locations**:
1. **Client-side**: Before upload (save bandwidth)
2. **Server-side**: Before S3 storage (save storage)
3. **Cross-user**: Shared resources (save globally)

**Benefits**:
- Reduced storage costs (30-50% typical savings)
- Faster uploads (skip duplicates)
- Improved performance (better cache hit rates)
- Simplified backups (fewer unique files)

## Sync Strategies Between Modes

### Upgrade Sync: LOCAL-ONLY → FULL
```typescript
async function syncLocalToFull() {
  const queue = await getSyncQueue();

  for (const item of queue) {
    try {
      // Extract user context from new auth
      const { userId } = await authService.getUserContext();

      // Upload to S3
      await uploadToS3(item.template, userId);

      // Save to PostgreSQL
      await saveMetadata(item.template, userId);

      // Log to Cassandra
      await logSyncEvent(item.template, 'LOCAL_TO_FULL');

      // Remove from queue
      await removeFromQueue(item.id);
    } catch (error) {
      await markSyncFailed(item.id, error);
    }
  }
}
```

### Recovery Sync: FALLBACK → FULL
```typescript
async function syncFallbackToFull() {
  const pending = await findFallbackTemplates();

  for (const template of pending) {
    try {
      // Move from .local-storage to S3
      await migrateToS3(template);

      // Update PostgreSQL
      await updateStorageMode(template.id, 'seaweedfs');

      // Log recovery
      await logRecoveryEvent(template.id);

      // Clean up local file
      await cleanupLocalFile(template.path);
    } catch (error) {
      // Keep in fallback, retry later
      await scheduleSyncRetry(template.id);
    }
  }
}
```

### Continuous Sync: Browser ↔ Server
```typescript
class ContinuousSync {
  private syncInterval = 30000; // 30 seconds

  async start() {
    setInterval(async () => {
      if (this.hasConnection()) {
        await this.syncPendingChanges();
        await this.refreshCache();
      }
    }, this.syncInterval);
  }

  private async syncPendingChanges() {
    const changes = await getLocalChanges();
    for (const change of changes) {
      await this.pushChange(change);
    }
  }

  private async refreshCache() {
    const stale = await findStaleCache();
    for (const item of stale) {
      await this.refreshItem(item);
    }
  }
}
```

## Best Practices for Harmonious Integration

### 1. Always Check Authentication First
```typescript
// ❌ WRONG
const saveTemplate = async (template) => {
  const userId = "hardcoded-id"; // NEVER!
  //...
}

// ✅ CORRECT
const saveTemplate = async (template) => {
  const auth = await authService.getCurrentUser();
  if (!auth.isAuthenticated) {
    return saveLocalOnly(template);
  }
  const { userId } = auth;
  //...
}
```

### 2. Never Embed Resources in Templates
```typescript
// ❌ WRONG
{
  elements: [{
    type: 'image',
    data: 'base64...' // NEVER embed!
  }]
}

// ✅ CORRECT
{
  elements: [{
    type: 'image',
    resourceUrl: 'https://s3.../resource.png',
    fallbackUrl: '/api/local/resource.png',
    hash: 'sha256...'
  }]
}
```

### 3. Implement Graceful Degradation
```typescript
async function loadResource(id: string): Promise<Resource> {
  const strategies = [
    () => loadFromCache(id),
    () => loadFromS3(id),
    () => loadFromLocal(id),
    () => loadFromBrowser(id),
    () => useExpiredCache(id),
    () => returnPlaceholder(id)
  ];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      continue; // Try next strategy
    }
  }

  throw new Error('All strategies failed');
}
```

### 4. Maintain Storage Mode Awareness
```typescript
interface StorageContext {
  mode: StorageMode;
  userId?: string;
  isAuthenticated: boolean;
  availableFeatures: string[];
  limitations?: string[];
}

class StorageManager {
  private context: StorageContext;

  async save(template: Template) {
    switch (this.context.mode) {
      case StorageMode.FULL:
        return this.saveFull(template);
      case StorageMode.FALLBACK:
        return this.saveFallback(template);
      case StorageMode.LOCAL_ONLY:
        return this.saveLocal(template);
    }
  }
}
```

### 5. Implement Automatic Recovery
```typescript
class AutoRecovery {
  async monitorAndRecover() {
    // Monitor S3 health
    const wasDown = this.s3WasDown;
    const isUp = await this.checkS3Health();

    if (wasDown && isUp) {
      // S3 is back! Migrate fallback data
      await this.migrateFallbackToS3();
      await this.notifyUsersOfRecovery();
    }

    // Monitor auth status
    const wasOffline = this.wasOffline;
    const isOnline = await this.checkAuth();

    if (wasOffline && isOnline) {
      // User authenticated! Sync local data
      await this.syncLocalToCloud();
    }
  }
}
```

## Performance Optimizations by Layer

### SeaweedFS (S3)
- Use multipart upload for large files (>5MB)
- Implement parallel uploads (max 5 concurrent)
- Use presigned URLs for direct browser upload
- Enable S3 acceleration if available
- Compress before upload (gzip for JSON)

### PostgreSQL
- Index frequently queried fields
- Use connection pooling
- Implement query result caching
- Batch inserts when possible
- Optimize JOIN queries

### Cassandra
- Batch event inserts
- Use appropriate consistency levels
- Partition by time period
- Implement TTL for old events
- Compress large event data

### .local-storage
- Implement file system quotas
- Regular cleanup of old files
- Use streams for large files
- Implement file locking
- Monitor disk usage

### Browser Storage
- Use IndexedDB for large data
- LocalStorage for small metadata
- Implement quota management
- Regular cache pruning
- Compress stored data

## Monitoring and Metrics

### Key Metrics to Track

**Storage Mode Distribution**:
```sql
SELECT storage_mode, COUNT(*)
FROM templates
GROUP BY storage_mode;
```

**Mode Transition Events**:
```cql
SELECT event_type, from_mode, to_mode, COUNT(*)
FROM mode_transitions
WHERE timestamp > now() - 1d;
```

**Cache Hit Rates**:
```typescript
{
  browserCache: 0.85,  // 85% hit rate
  cdnCache: 0.92,      // 92% hit rate
  serverCache: 0.78    // 78% hit rate
}
```

**Storage Usage**:
```typescript
{
  seaweedfs: { used: '2.3TB', quota: '10TB' },
  localStorage: { used: '45GB', quota: '100GB' },
  browserStorage: { avg: '125MB', max: '500MB' }
}
```

**Sync Queue Status**:
```typescript
{
  pending: 23,
  failed: 2,
  succeeded_24h: 1847,
  avg_sync_time: '3.2s'
}
```

### Health Checks

```typescript
interface HealthStatus {
  seaweedfs: { healthy: boolean; latency: number };
  postgres: { healthy: boolean; connections: number };
  cassandra: { healthy: boolean; nodes: number };
  localStorage: { healthy: boolean; diskSpace: number };
  browserStorage: { supported: boolean; quota: number };
}
```

## Error Recovery Procedures

### S3 Failure Recovery
1. Detect failure (timeout/error)
2. Switch to FALLBACK mode
3. Queue templates for sync
4. Monitor S3 health
5. Auto-migrate when recovered

### Database Failure Recovery
1. For PostgreSQL: Use read replica
2. For Cassandra: Use remaining nodes
3. Queue writes if all fail
4. Alert administrators
5. Auto-reconnect when available

### Browser Storage Failure
1. Detect quota exceeded
2. Prune old cache (LRU)
3. Compress if possible
4. Alert user if critical
5. Offer cleanup options

## Security Considerations

### Authentication
- Always verify JWT tokens
- Extract userId from token (never trust client)
- Validate permissions before operations
- Implement rate limiting
- Log access attempts

### Encryption
- TLS for all network traffic
- Encrypt sensitive data at rest
- Use encrypted cookies
- Implement key rotation
- Secure token storage

### Access Control
- User can only access own templates
- Implement sharing permissions
- Validate all inputs
- Sanitize file uploads
- Prevent path traversal

## Implementation Checklist

### Phase 1: Foundation
- [ ] Implement mode detection service
- [ ] Create storage manager abstraction
- [ ] Add authentication context
- [ ] Setup health monitoring
- [ ] Create sync queue

### Phase 2: Storage Layers
- [ ] Configure SeaweedFS client
- [ ] Create PostgreSQL schema
- [ ] Setup Cassandra tables
- [ ] Implement .local-storage service
- [ ] Add browser storage service

### Phase 3: Fallback Logic
- [ ] Implement cascade strategies
- [ ] Add automatic failover
- [ ] Create recovery procedures
- [ ] Setup sync mechanisms
- [ ] Add mode transitions

### Phase 4: Optimization
- [ ] Implement caching layers
- [ ] Add resource deduplication
- [ ] Setup CDN integration
- [ ] Optimize queries
- [ ] Add compression

### Phase 5: Monitoring
- [ ] Add metrics collection
- [ ] Create dashboards
- [ ] Setup alerts
- [ ] Implement logging
- [ ] Add performance tracking

## Conclusion

The harmonious storage integration strategy ensures that the E-Cards system remains operational under all conditions. By treating each storage layer as a valuable component rather than a redundancy, the system achieves:

1. **100% Uptime**: Always operational, regardless of service failures
2. **Zero Data Loss**: Multiple fallback mechanisms prevent loss
3. **Optimal Performance**: Right storage for right purpose
4. **Seamless Experience**: Users unaware of backend complexity
5. **Cost Efficiency**: Deduplication and smart caching reduce costs

The key is understanding that **every layer has a purpose**, and when they work together in harmony, the system becomes resilient, performant, and reliable.

## Quick Reference

### When to Use Each Storage

| Storage | When to Use | What to Store |
|---------|------------|---------------|
| **SeaweedFS** | Authenticated + Available | Templates, Resources, Archives |
| **PostgreSQL** | Always (authenticated) | Metadata, Relations, Permissions |
| **Cassandra** | Always (authenticated) | Events, Logs, Time-series |
| **.local-storage** | S3 down + Authenticated | Temporary fallback for everything |
| **Browser** | Always | Cache, WIP, Offline queue |

### Mode Quick Check

```typescript
if (!authenticated) return 'LOCAL_ONLY';
if (!s3Available) return 'FALLBACK';
return 'FULL';
```

### Storage Priority

1. Browser Cache (fastest)
2. CDN (if available)
3. SeaweedFS (primary)
4. .local-storage (fallback)
5. Browser Storage (offline)

Remember: **Harmonious Integration = Resilient System**