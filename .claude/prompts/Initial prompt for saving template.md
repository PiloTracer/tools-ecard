# Template Save Functionality - Complete Specification

**Last Updated**: 2025-01-20
**Version**: 3.0 - Multi-Mode Architecture with Graceful Degradation

## Overview
This document defines the complete implementation specification for saving templates in the template-textile feature, using a harmoniously balanced multi-mode storage architecture that gracefully degrades based on authentication and service availability.

## CRITICAL: Three-Mode Architecture

The system operates in THREE distinct modes based on authentication and service availability:

### 1. FULL MODE (Authenticated + SeaweedFS Available)
- User is authenticated (valid JWT token)
- SeaweedFS is accessible and healthy
- All services operational
- Resources stored as separate S3 objects
- Full database support (PostgreSQL + Cassandra)

### 2. FALLBACK MODE (Authenticated + SeaweedFS Unavailable)
- User is authenticated (valid JWT token)
- SeaweedFS is down or unreachable
- `.local-storage` directory used as fallback
- PostgreSQL and Cassandra still operational
- System continues to function with local storage

### 3. LOCAL-ONLY MODE (Not Authenticated)
- No authentication available
- Browser-only operation
- IndexedDB/localStorage for all storage
- No server communication
- Templates queued for sync when authenticated

## Authentication Integration

### NEVER Hardcode User Information
```typescript
// ❌ WRONG - Never hardcode userId or username
const saveTemplate = async (template) => {
  const userId = "hardcoded-user-id"; // NEVER DO THIS
  // ...
}

// ✅ CORRECT - Extract from authentication context
const saveTemplate = async (template) => {
  const auth = await authService.getCurrentUser();
  if (!auth.isAuthenticated) {
    return saveLocalOnly(template);
  }

  const { userId, username } = auth;
  // ...
}
```

### Mode Detection Before Save
```typescript
async function detectSaveMode(): Promise<SaveMode> {
  // Step 1: Check authentication
  const auth = await authService.isAuthenticated();
  if (!auth) {
    return SaveMode.LOCAL_ONLY;
  }

  // Step 2: Check SeaweedFS health
  try {
    const health = await checkSeaweedFSHealth();
    if (health.status === 'healthy') {
      return SaveMode.FULL;
    }
  } catch (error) {
    console.warn('SeaweedFS unavailable, using fallback');
  }

  // Step 3: Check fallback availability
  const fallbackAvailable = await checkFallbackStorage();
  if (fallbackAvailable) {
    return SaveMode.FALLBACK;
  }

  // Last resort: local only even if authenticated
  return SaveMode.LOCAL_ONLY;
}
```

## Resource Management Strategy

### Resources as Separate Objects (NEVER Embedded)
```typescript
// ❌ WRONG - Never embed resources in template JSON
interface WrongTemplate {
  elements: [{
    type: 'image',
    data: 'base64EncodedImageData...', // NEVER DO THIS
  }]
}

// ✅ CORRECT - Store resources separately with URLs
interface CorrectTemplate {
  elements: [{
    type: 'image',
    resourceUrl: 'https://s3.example.com/resources/abc123.png', // Reference URL
    fallbackUrl: '/api/storage/local/resources/abc123.png',    // Fallback URL
    hash: 'abc123...' // For deduplication
  }]
}
```

### Resource Deduplication
```typescript
async function processResource(resource: File): Promise<ResourceInfo> {
  // Calculate hash for deduplication
  const hash = await calculateSHA256(resource);

  // Check if resource already exists
  const existing = await checkResourceByHash(hash);
  if (existing) {
    return {
      url: existing.url,
      hash: hash,
      deduplicated: true
    };
  }

  // New resource needs upload
  return uploadNewResource(resource, hash);
}
```

## Storage Flow by Mode

### FULL MODE - Save Flow
```typescript
async function saveFullMode(template: Template, resources: Resource[]) {
  // 1. Extract user context from auth
  const { userId, username } = await authService.getUserContext();

  // 2. Upload resources to SeaweedFS (separate objects)
  const uploadedResources = await Promise.all(
    resources.map(r => uploadToSeaweedFS(r, userId))
  );

  // 3. Update template with resource URLs
  const templateWithUrls = replaceResourceUrls(template, uploadedResources);

  // 4. Save template JSON to SeaweedFS
  const templateS3Key = `templates/${userId}/${projectId}/${templateId}/template.json`;
  const templateUrl = await s3Service.putObject('ecards', templateS3Key, templateWithUrls);

  // 5. Update PostgreSQL (normalized data)
  await prisma.template.upsert({
    where: { id: templateId },
    create: {
      id: templateId,
      userId,  // From auth context
      name: template.name,
      storageUrl: templateUrl,
      storageMode: 'seaweedfs',
      elementCount: template.elements.length,
      // ... other fields
    },
    update: {
      storageUrl: templateUrl,
      updatedAt: new Date()
    }
  });

  // 6. Log to Cassandra (events and large metadata)
  await cassandra.execute(
    `INSERT INTO template_metadata (template_id, user_id, full_metadata, updated_at)
     VALUES (?, ?, ?, ?)`,
    [templateId, userId, JSON.stringify(template), new Date()]
  );

  // 7. Clear browser working storage
  await browserStorage.clearWorkingTemplate();

  return { success: true, mode: 'full', templateId };
}
```

### FALLBACK MODE - Save Flow
```typescript
async function saveFallbackMode(template: Template, resources: Resource[]) {
  // 1. Extract user context from auth
  const { userId, username } = await authService.getUserContext();

  // 2. Save resources to .local-storage directory
  const savedResources = await Promise.all(
    resources.map(r => saveToLocalStorage(r, userId))
  );

  // 3. Update template with local paths
  const templateWithPaths = replaceResourceUrls(template, savedResources);

  // 4. Save template JSON to .local-storage
  const localPath = `.local-storage/users/${userId}/templates/${templateId}/template.json`;
  await fs.writeFile(localPath, JSON.stringify(templateWithPaths));

  // 5. Still update PostgreSQL (with fallback flag)
  await prisma.template.upsert({
    where: { id: templateId },
    create: {
      id: templateId,
      userId,  // From auth context
      name: template.name,
      storageUrl: localPath,
      storageMode: 'local',  // Mark as fallback storage
      elementCount: template.elements.length,
      // ... other fields
    },
    update: {
      storageUrl: localPath,
      storageMode: 'local',
      updatedAt: new Date()
    }
  });

  // 6. Still log to Cassandra
  await cassandra.execute(
    `INSERT INTO template_events (user_id, template_id, event_id, event_type, storage_mode, event_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, templateId, TimeUuid.now(), 'TEMPLATE_SAVED', 'fallback', JSON.stringify(template), new Date()]
  );

  // 7. Queue for sync to S3 when available
  await addToSyncQueue({
    type: 'MIGRATE_TO_S3',
    templateId,
    localPath,
    priority: 'low'
  });

  return { success: true, mode: 'fallback', templateId };
}
```

### LOCAL-ONLY MODE - Save Flow
```typescript
async function saveLocalOnlyMode(template: Template, resources: Resource[]) {
  // No authentication - use browser fingerprint
  const browserId = await getBrowserFingerprint();

  // 1. Save everything to IndexedDB
  await browserStorage.saveTemplate({
    id: templateId,
    template,
    resources: await Promise.all(resources.map(r => r.arrayBuffer())),
    savedAt: new Date(),
    syncStatus: 'local'
  });

  // 2. Add to sync queue for when authenticated
  await browserStorage.addToSyncQueue({
    type: 'TEMPLATE_SAVE',
    data: {
      template,
      resources: resources.map(r => ({
        name: r.name,
        type: r.type,
        size: r.size,
        hash: r.hash
      }))
    },
    createdAt: new Date(),
    browserId
  });

  // 3. Update UI to show local save
  showNotification('Template saved locally. Will sync when you sign in.', 'info');

  return { success: true, mode: 'local', templateId };
}
```

## Graceful Mode Transitions

### Automatic Mode Detection and Switching
```typescript
class SaveManager {
  private currentMode: SaveMode = SaveMode.LOCAL_ONLY;

  async save(template: Template, resources: Resource[]) {
    const newMode = await detectSaveMode();

    // Handle mode change
    if (newMode !== this.currentMode) {
      await this.handleModeTransition(this.currentMode, newMode);
      this.currentMode = newMode;
    }

    // Save based on current mode
    switch (this.currentMode) {
      case SaveMode.FULL:
        return await saveFullMode(template, resources);

      case SaveMode.FALLBACK:
        return await saveFallbackMode(template, resources);

      case SaveMode.LOCAL_ONLY:
        return await saveLocalOnlyMode(template, resources);
    }
  }

  private async handleModeTransition(from: SaveMode, to: SaveMode) {
    // Transitioning from LOCAL_ONLY to authenticated mode
    if (from === SaveMode.LOCAL_ONLY && to !== SaveMode.LOCAL_ONLY) {
      await this.syncLocalTemplates();
    }

    // Transitioning from FALLBACK to FULL
    if (from === SaveMode.FALLBACK && to === SaveMode.FULL) {
      await this.migrateFromFallbackToS3();
    }

    // Notify UI of mode change
    eventBus.emit('storage-mode-changed', { from, to });
  }

  private async syncLocalTemplates() {
    const queue = await browserStorage.getSyncQueue();

    for (const item of queue) {
      try {
        if (item.type === 'TEMPLATE_SAVE') {
          // Now we have auth, extract userId
          const { userId } = await authService.getUserContext();

          // Save to server with proper userId
          await saveFullMode(item.data.template, item.data.resources);

          // Remove from queue
          await browserStorage.removeFromSyncQueue(item.id);
        }
      } catch (error) {
        console.error('Failed to sync template:', error);
      }
    }
  }
}
```

## UI Components with Mode Awareness

### Save Button with Mode Indicator
```tsx
const SaveButton: React.FC = () => {
  const [mode, setMode] = useState<SaveMode>();
  const [saving, setSaving] = useState(false);

  const getModeIcon = () => {
    switch (mode) {
      case SaveMode.FULL:
        return <CloudIcon color="success" />;
      case SaveMode.FALLBACK:
        return <CloudOffIcon color="warning" />;
      case SaveMode.LOCAL_ONLY:
        return <OfflineIcon color="info" />;
      default:
        return <SaveIcon />;
    }
  };

  const getModeTooltip = () => {
    switch (mode) {
      case SaveMode.FULL:
        return "Save to cloud storage";
      case SaveMode.FALLBACK:
        return "Cloud unavailable - saving locally on server";
      case SaveMode.LOCAL_ONLY:
        return "Offline - saving to browser storage";
      default:
        return "Save template";
    }
  };

  return (
    <Tooltip title={getModeTooltip()}>
      <IconButton onClick={handleSave} disabled={saving}>
        {saving ? <CircularProgress size={24} /> : getModeIcon()}
      </IconButton>
    </Tooltip>
  );
};
```

### Save Dialog with Authentication Check
```tsx
const SaveDialog: React.FC = ({ open, onClose }) => {
  const [mode, setMode] = useState<SaveMode>();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndMode();
  }, [open]);

  const checkAuthAndMode = async () => {
    const auth = await authService.isAuthenticated();
    setIsAuthenticated(auth);

    const detectedMode = await detectSaveMode();
    setMode(detectedMode);
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>Sign In Required</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            You can save templates locally without signing in,
            or sign in to save to the cloud.
          </Alert>
          <Box mt={2}>
            <Button onClick={saveLocally} variant="outlined">
              Save Locally
            </Button>
            <Button onClick={redirectToLogin} variant="contained" sx={{ ml: 2 }}>
              Sign In
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Save Template
        {mode === SaveMode.FALLBACK && (
          <Chip label="Fallback Mode" size="small" color="warning" sx={{ ml: 2 }} />
        )}
      </DialogTitle>
      <DialogContent>
        {/* Regular save dialog content */}
      </DialogContent>
    </Dialog>
  );
};
```

## API Endpoints with Mode Support

### Save Template Endpoint
```typescript
POST /api/templates/save
Headers: {
  Authorization: Bearer {token}  // Required for FULL/FALLBACK modes
  Content-Type: multipart/form-data
  X-Storage-Mode: string  // Client hint about detected mode
}
Body: FormData {
  templateName: string
  projectId: string
  template: JSON (Template object without embedded resources)
  resources: File[] (separate resource files)
  thumbnail?: File
}
Response: {
  success: boolean
  templateId: string
  version: number
  savedAt: string
  storageMode: 'full' | 'fallback' | 'local'
  storageUrl: string  // S3 URL or local path
  resourceUrls: Record<string, string>
  syncStatus?: 'synced' | 'pending' | 'failed'
}

Error Responses:
401: {
  error: "Authentication required",
  suggestion: "Save locally or sign in",
  canSaveLocally: true
}
503: {
  error: "Storage service unavailable",
  fallbackMode: "local",
  canRetry: true
}
```

## Error Handling by Mode

### FULL MODE Errors
```typescript
async function handleFullModeError(error: Error) {
  if (error.message.includes('S3')) {
    // Try fallback to local storage
    console.warn('S3 failed, switching to fallback mode');
    return await saveFallbackMode(template, resources);
  }

  throw error; // Unrecoverable error
}
```

### FALLBACK MODE Errors
```typescript
async function handleFallbackModeError(error: Error) {
  if (error.message.includes('disk full')) {
    // Clean up old files
    await cleanupOldFallbackFiles();
    // Retry
    return await saveFallbackMode(template, resources);
  }

  // Last resort - save to browser
  return await saveLocalOnlyMode(template, resources);
}
```

### LOCAL_ONLY MODE Errors
```typescript
async function handleLocalModeError(error: Error) {
  if (error.name === 'QuotaExceededError') {
    // Browser storage full
    const freed = await browserStorage.pruneOldTemplates();
    showNotification(`Freed ${freed}MB of storage`);
    // Retry
    return await saveLocalOnlyMode(template, resources);
  }

  throw error; // Cannot save anywhere
}
```

## Performance Optimizations by Mode

### FULL MODE Optimizations
- Parallel resource uploads (max 5 concurrent)
- CDN integration for resource delivery
- Resource deduplication via hash
- Compression before S3 upload

### FALLBACK MODE Optimizations
- Local file system caching
- Batch writes to reduce I/O
- Background sync to S3 when available
- LRU cache for frequently accessed resources

### LOCAL_ONLY MODE Optimizations
- IndexedDB for large data
- localStorage for small metadata
- Aggressive compression
- Automatic cleanup of old templates

## Security Considerations

### Authentication Requirements
```typescript
// FULL and FALLBACK modes
if (mode !== SaveMode.LOCAL_ONLY) {
  // Extract userId from JWT token
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.sub;

  // NEVER accept userId from request body
  if (req.body.userId) {
    throw new Error('userId must not be in request body');
  }
}
```

### Mode-Specific Security
- **FULL MODE**: Full authentication, encrypted transport, S3 ACLs
- **FALLBACK MODE**: Full authentication, file system permissions
- **LOCAL_ONLY MODE**: Browser sandbox, no server access

## Testing Requirements

### Mode Detection Tests
```typescript
describe('Mode Detection', () => {
  test('detects FULL mode when authenticated and S3 available', async () => {
    mockAuth({ isAuthenticated: true });
    mockS3({ available: true });

    const mode = await detectSaveMode();
    expect(mode).toBe(SaveMode.FULL);
  });

  test('detects FALLBACK when authenticated but S3 down', async () => {
    mockAuth({ isAuthenticated: true });
    mockS3({ available: false });

    const mode = await detectSaveMode();
    expect(mode).toBe(SaveMode.FALLBACK);
  });

  test('detects LOCAL_ONLY when not authenticated', async () => {
    mockAuth({ isAuthenticated: false });

    const mode = await detectSaveMode();
    expect(mode).toBe(SaveMode.LOCAL_ONLY);
  });
});
```

### Mode Transition Tests
```typescript
describe('Mode Transitions', () => {
  test('syncs local templates when transitioning to authenticated', async () => {
    // Start in LOCAL_ONLY
    await saveLocalOnlyMode(template, resources);

    // Authenticate
    await authService.login(credentials);

    // Should sync automatically
    await waitForSync();

    // Verify template now in S3
    const saved = await loadFromS3(templateId);
    expect(saved).toBeDefined();
  });
});
```

## Implementation Checklist

### Critical Requirements
- [x] NEVER hardcode userId or username
- [x] Always extract user info from auth context
- [x] Implement three-mode detection
- [x] Resources as separate objects (never embedded)
- [x] Graceful degradation between modes
- [x] Preserve .local-storage as fallback

### Mode Implementation
- [ ] FULL mode save flow
- [ ] FALLBACK mode save flow
- [ ] LOCAL_ONLY mode save flow
- [ ] Mode detection service
- [ ] Mode transition handling
- [ ] Sync queue for LOCAL_ONLY → authenticated

### Storage Layers
- [ ] SeaweedFS integration (separate objects)
- [ ] PostgreSQL normalized data
- [ ] Cassandra event logging
- [ ] .local-storage fallback service
- [ ] Browser IndexedDB service

### UI Components
- [ ] Mode-aware save button
- [ ] Authentication check in save dialog
- [ ] Mode indicator in UI
- [ ] Sync status indicator

### Testing
- [ ] Mode detection tests
- [ ] Save flow tests for each mode
- [ ] Mode transition tests
- [ ] Authentication integration tests
- [ ] Resource deduplication tests

## Success Metrics

### By Mode
- **FULL MODE**: Save < 2s (p95), 99.9% success rate
- **FALLBACK MODE**: Save < 1.5s (p95), 99% success rate
- **LOCAL_ONLY MODE**: Save < 500ms (p95), 100% success rate
- **Mode transitions**: < 2s, automatic sync success > 95%
- **Resource deduplication**: > 30% storage savings