# Plan: Clean Up Excessive Debug Logging

**Created:** 2025-01-25
**Status:** Planned
**Priority:** High
**Effort:** Medium (4-6 hours)

---

## Problem Statement

Excessive debug logging is causing:
- ❌ **Docker Desktop logs jumping continuously** - unreadable
- ❌ **Performance degradation** - I/O overhead from constant logging
- ❌ **Difficult debugging** - signal lost in noise
- ❌ **Log files growing rapidly** - storage waste
- ❌ **Development experience degraded** - can't find actual errors

### Current State

**Prisma Queries:**
- Every SQL query logged with full details
- Every parameter set logged
- Every internal Prisma operation logged
- Example: Single request = 50+ log lines

**Console Statements:**
- **173 console.log/debug/info/warn** across 20 files in api-server
- Many are redundant or overly verbose
- No consistent logging strategy

**Impact:**
```
Single API request → 100+ log lines
Docker Desktop → Logs scroll too fast to read
Finding actual errors → Nearly impossible
```

---

## Goals

1. ✅ **Readable logs** - Can see and track actual application flow
2. ✅ **Error visibility** - Errors stand out clearly
3. ✅ **Performance** - Reduced I/O overhead
4. ✅ **Maintainable** - Structured logging approach
5. ✅ **Environment-aware** - Different levels for dev/prod

---

## Solution Strategy

### Phase 1: Disable Prisma Query Logging (Quick Win - 30 mins)

**Impact:** Reduces log volume by ~70%

**Actions:**

1. **Remove Prisma debug logging from environment**
   - File: `docker-compose.dev.yml`
   - Remove or comment: `DEBUG=prisma:*` environment variable
   - Or set to production level: `DEBUG=prisma:error`

2. **Update Prisma client configuration**
   - File: `api-server/src/core/database/prisma.ts`
   - Configure Prisma logging levels:
     ```typescript
     const prisma = new PrismaClient({
       log: [
         { level: 'error', emit: 'stdout' },
         { level: 'warn', emit: 'stdout' },
         // Remove or comment in development:
         // { level: 'query', emit: 'stdout' },
         // { level: 'info', emit: 'stdout' },
       ],
     });
     ```

3. **Environment-based configuration**
   - Use `NODE_ENV` to control Prisma logging
   - Development: errors + warnings only
   - Production: errors only

**Expected Reduction:** 70-80% of current log volume

---

### Phase 2: Implement Structured Logging (2 hours)

**Replace console.log with proper logging library**

#### Option A: Pino (Recommended - Already used by Fastify)

**Benefits:**
- ✅ Already installed (Fastify uses it)
- ✅ Structured JSON logging
- ✅ Log levels (trace, debug, info, warn, error, fatal)
- ✅ Performance optimized
- ✅ Easy filtering

**Implementation:**

1. **Create logging utility**
   - File: `api-server/src/core/utils/logger.ts`
   ```typescript
   import pino from 'pino';

   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV === 'development'
       ? { target: 'pino-pretty' }
       : undefined,
   });

   // Feature-specific loggers
   export const createLogger = (module: string) =>
     logger.child({ module });
   ```

2. **Replace console statements systematically**
   - Search: `console.log` → Replace: `logger.info`
   - Search: `console.error` → Replace: `logger.error`
   - Search: `console.warn` → Replace: `logger.warn`
   - Search: `console.debug` → Replace: `logger.debug`

3. **Add context to logs**
   ```typescript
   // Before
   console.log('Template saved:', templateId);

   // After
   logger.info({ templateId, userId }, 'Template saved');
   ```

#### Option B: Winston (Alternative)

**Benefits:**
- ✅ More flexible transports
- ✅ Multiple outputs (file, console, remote)
- ✅ Custom formats

**Trade-off:** Slightly more overhead than Pino

---

### Phase 3: Clean Up Existing Logs (2 hours)

**Systematic review and cleanup**

#### 3.1 Categorize Logs

**Keep (convert to logger):**
- ✅ Errors and warnings
- ✅ Important state changes
- ✅ Authentication events
- ✅ Database connection status
- ✅ Job processing milestones

**Remove completely:**
- ❌ Redundant "entering function" logs
- ❌ Verbose object dumps (unless error)
- ❌ Success confirmations for routine operations
- ❌ Debugging that's no longer needed

**Convert to debug level:**
- 🔧 Detailed request/response logging
- 🔧 Internal state transitions
- 🔧 Development-only diagnostics

#### 3.2 File-by-File Cleanup

**High Priority (Most Verbose):**

1. `api-server/src/features/template-textile/services/unifiedTemplateStorageService.ts`
   - Currently: 29+ console.log statements
   - Target: 5-8 meaningful log points at appropriate levels

2. `api-server/src/features/batch-parsing/services/batchParsingService.ts`
   - Currently: 8+ console statements
   - Target: Error logging + milestone events only

3. `api-server/src/core/cassandra/init.ts`
   - Currently: 11 console statements
   - Target: 3-4 (connection status, errors)

4. `api-server/src/core/middleware/authMiddleware.ts`
   - Currently: 2 console statements
   - Should be: Structured auth events

**Pattern to Follow:**
```typescript
// BEFORE
console.log('[UnifiedTemplateStorage] saveTemplate called');
console.log('[UnifiedTemplateStorage] User ID:', userId, 'Email:', userEmail);
console.log('[UnifiedTemplateStorage] Using project ID:', projectId);
console.log('[UnifiedTemplateStorage] Storage mode:', storageMode);
console.log('[UnifiedTemplateStorage] Processing', input.resources.length, 'resources');
console.log('[UnifiedTemplateStorage] Resource', i, 'keys:', Object.keys(resource || {}));

// AFTER
const log = createLogger('TemplateStorage');

log.debug({ userId, userEmail }, 'Starting template save');
log.debug({ projectId, storageMode }, 'Using storage configuration');
if (input.resources?.length > 0) {
  log.debug({ resourceCount: input.resources.length }, 'Processing resources');
}
// Only log individual resources on trace level or if error
```

---

### Phase 4: Configure Log Levels by Environment (30 mins)

**Environment Variables:**

```bash
# .env.dev.example
LOG_LEVEL=info              # Development: info level
PRISMA_LOG_LEVEL=warn       # Prisma: warnings only

# .env.production.example
LOG_LEVEL=warn              # Production: warnings and errors
PRISMA_LOG_LEVEL=error      # Prisma: errors only
```

**docker-compose.dev.yml:**
```yaml
api-server:
  environment:
    LOG_LEVEL: ${LOG_LEVEL:-info}
    # Remove or disable Prisma debug logging
    # DEBUG: prisma:*  ← REMOVE THIS
```

**Levels:**
- `trace` (5): Very detailed, every step
- `debug` (4): Development diagnostics
- `info` (3): General informational
- `warn` (2): Warning conditions
- `error` (1): Error conditions
- `fatal` (0): Fatal errors

**Default Settings:**
- Development: `info` (shows info, warn, error, fatal)
- Production: `warn` (shows warn, error, fatal)
- Debug mode: `debug` or `trace` (when actively debugging)

---

### Phase 5: Add Log Rotation (30 mins)

**Prevent log files from growing indefinitely**

**For Docker Compose:**
```yaml
# docker-compose.dev.yml
api-server:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

**For Application Logs:**
```typescript
// api-server/src/core/utils/logger.ts
import pino from 'pino';
import { pino as pinoPretty } from 'pino-pretty';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        }
      }
    : undefined,
});
```

---

## Implementation Checklist

### Phase 1: Immediate (30 mins)
- [ ] Remove `DEBUG=prisma:*` from docker-compose.dev.yml
- [ ] Configure Prisma client logging levels
- [ ] Set default LOG_LEVEL to 'info'
- [ ] Test: Verify log volume reduced significantly
- [ ] Restart services and observe logs

### Phase 2: Structured Logging (2 hours)
- [ ] Install pino-pretty for development: `npm install --save-dev pino-pretty`
- [ ] Create `api-server/src/core/utils/logger.ts`
- [ ] Export logger and createLogger utility
- [ ] Update 5-10 high-volume files to use logger
- [ ] Test: Verify structured logs work correctly

### Phase 3: Cleanup (2 hours)
- [ ] Review and clean `unifiedTemplateStorageService.ts`
- [ ] Review and clean `batchParsingService.ts`
- [ ] Review and clean `cassandra/init.ts`
- [ ] Review and clean `authMiddleware.ts`
- [ ] Review and clean remaining high-volume files
- [ ] Remove unnecessary logs
- [ ] Convert important logs to appropriate levels

### Phase 4: Configuration (30 mins)
- [ ] Add LOG_LEVEL to .env.dev.example
- [ ] Add PRISMA_LOG_LEVEL to .env.dev.example
- [ ] Update docker-compose.dev.yml environment
- [ ] Create .env.production.example with production settings
- [ ] Document logging configuration in README

### Phase 5: Log Rotation (30 mins)
- [ ] Add logging configuration to docker-compose.dev.yml
- [ ] Configure max log size and file count
- [ ] Test log rotation works
- [ ] Document for production deployment

---

## Testing Strategy

### Before Changes
1. Start services: `docker-compose -f docker-compose.dev.yml up -d`
2. Make API request
3. Observe: Logs jump continuously, unreadable
4. Count log lines for single request: ~100+

### After Phase 1
1. Apply Prisma logging changes
2. Restart services
3. Make API request
4. Observe: Log volume reduced 70%
5. Verify: Can read logs in Docker Desktop

### After Phase 2
1. Apply structured logging
2. Restart services
3. Verify: Logs are JSON structured
4. Verify: Log levels work correctly

### After Phase 3
1. Apply cleanup
2. Restart services
3. Verify: Only meaningful logs appear
4. Verify: Errors still clearly visible

### After Complete
1. Normal operation: info level logs, readable
2. Error scenario: Error stands out clearly
3. Debug mode: Set LOG_LEVEL=debug, see detailed info
4. Production simulation: Set LOG_LEVEL=warn, minimal output

---

## Expected Outcomes

### Metrics

**Before:**
- Lines per API request: ~100-150
- Docker Desktop: Unusable (continuous jumping)
- Error visibility: Poor (buried in noise)
- Log file growth: ~10 MB/hour

**After:**
- Lines per API request: ~5-10
- Docker Desktop: Readable
- Error visibility: Excellent (clear highlighting)
- Log file growth: ~1 MB/hour (90% reduction)

### Developer Experience

**Before:**
```
❌ Can't read logs in real-time
❌ Can't find errors
❌ Can't track request flow
❌ Debugging is painful
```

**After:**
```
✅ Logs readable in real-time
✅ Errors clearly visible
✅ Request flow traceable
✅ Debugging is effective
```

---

## Code Examples

### Logger Setup

```typescript
// api-server/src/core/utils/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{module} | {msg}',
    },
  } : undefined,
});

export const createLogger = (module: string) =>
  logger.child({ module });
```

### Usage Examples

```typescript
// Feature-specific logger
const log = createLogger('TemplateStorage');

// Different log levels
log.trace({ detail: 'value' }, 'Very detailed trace');
log.debug({ userId, templateId }, 'Processing template');
log.info({ count: 5 }, 'Templates saved');
log.warn({ missing: 'field' }, 'Optional field not provided');
log.error({ error: err }, 'Failed to save template');
log.fatal({ error: err }, 'Critical system failure');

// With context
try {
  await saveTemplate(data);
  log.info({ templateId: data.id }, 'Template saved successfully');
} catch (error) {
  log.error({
    error,
    templateId: data.id,
    userId: data.userId
  }, 'Template save failed');
  throw error;
}
```

---

## Rollback Plan

If issues arise:

1. **Immediate rollback:**
   ```bash
   # Restore Prisma debug logging
   # Uncomment in docker-compose.dev.yml
   DEBUG: prisma:*

   # Restart
   docker-compose -f docker-compose.dev.yml restart api-server
   ```

2. **Partial rollback:**
   - Keep structured logging
   - Restore specific console.log statements temporarily
   - Increase LOG_LEVEL to debug or trace

3. **Complete rollback:**
   - Revert all logging changes via git
   - Keep only environment-based log level control

---

## Future Enhancements

**Phase 6: Centralized Logging (Future)**
- Log aggregation (ELK stack, Grafana Loki)
- Log shipping (to external service)
- Log analytics and alerting

**Phase 7: Request Tracing (Future)**
- Add request IDs to all logs
- Trace requests across services
- Distributed tracing (OpenTelemetry)

**Phase 8: Metrics (Future)**
- Separate metrics from logs
- Prometheus metrics export
- Performance dashboards

---

## Priority Order

**Do First (Immediate Relief):**
1. ✅ Phase 1: Disable Prisma query logging (30 mins)
2. ✅ Test and verify improvement

**Do Next (Proper Solution):**
3. ✅ Phase 2: Implement structured logging (2 hours)
4. ✅ Phase 3: Clean up existing logs (2 hours)

**Do When Stable:**
5. ✅ Phase 4: Configure log levels (30 mins)
6. ✅ Phase 5: Add log rotation (30 mins)

---

## Success Criteria

- ✅ Docker Desktop logs are readable
- ✅ Can follow request flow without jumping
- ✅ Errors stand out clearly
- ✅ Log volume reduced by 80-90%
- ✅ Structured logs with proper levels
- ✅ Environment-aware configuration
- ✅ Documentation updated

---

## Notes

**Why This Matters:**
Excessive logging is not just annoying - it:
- Masks real errors
- Impacts performance
- Wastes storage
- Slows down debugging
- Creates poor developer experience

**Philosophy:**
- Log what matters
- Log at appropriate levels
- Make errors obvious
- Keep routine operations quiet
- Let developers choose verbosity

**Remember:**
> "The best log message is the one you don't have to write because the code is self-explanatory. The second best is the one that helps you fix the bug in 5 minutes instead of 5 hours."

---

**Status:** Ready to implement
**Estimated Total Time:** 4-6 hours
**Expected Benefit:** 80-90% reduction in log volume, dramatically improved debugging experience
