# Logging Configuration

This project uses **Pino** for structured JSON logging with environment-based configuration.

## Quick Start

### Environment Variables

```bash
# Set log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info        # Development: info, Production: warn

# Control debug output (exclude Prisma by default)
DEBUG=*,-prisma:*     # Log everything except Prisma queries
```

### Log Levels

- `trace` (5): Very detailed debugging (function entry/exit)
- `debug` (4): Detailed diagnostics
- `info` (3): General informational messages (default in development)
- `warn` (2): Warning conditions
- `error` (1): Error conditions
- `fatal` (0): Critical errors causing shutdown

## Usage

### Import Logger

```typescript
import { createLogger } from './core/utils/logger';

const log = createLogger('ModuleName');
```

### Basic Logging

```typescript
// Simple message
log.info('Server started');

// With context
log.info({ userId, email }, 'User authenticated');

// Error logging
log.error({ error, templateId }, 'Failed to save template');
```

### Module-Specific Loggers

```typescript
const log = createLogger('TemplateStorage');

log.debug({ templateId, projectId }, 'Processing template');
log.info({ templateId }, 'Template saved successfully');
log.error({ error, templateId }, 'Save failed');
```

## Configuration

### Development

- **Pretty output**: Colored, human-readable logs via `pino-pretty`
- **Default level**: `info`
- **Format**: `{timestamp} {module} | {message} {context}`

### Production

- **JSON output**: Structured logs for log aggregation
- **Default level**: `warn`
- **No pretty printing**: Raw JSON for performance

### Prisma Logging

Configured in `src/core/database/prisma.ts`:

```typescript
log: appConfig.env === 'development' ? ['error', 'warn'] : ['error']
```

Query logging is **disabled** to reduce log volume.

## Log Rotation

Configured in `docker-compose.dev.yml`:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"    # 10MB per file
    max-file: "3"      # Keep 3 files (30MB total)
```

## Best Practices

### ✅ Do

- Use structured context: `log.info({ userId, action }, 'Message')`
- Log errors with error objects: `log.error({ error }, 'Failed')`
- Use appropriate levels (don't log routine operations at `info` level)
- Create module-specific loggers for better filtering

### ❌ Don't

- Use `console.log()` (use structured logger instead)
- Log sensitive data (passwords, tokens, PII)
- Log verbose data in production
- Use string concatenation for context

### Example: Before and After

```typescript
// ❌ Before
console.log('[TemplateStorage] Saving template:', templateId);
console.log('[TemplateStorage] User:', userId, 'Project:', projectId);
console.error('Failed to save:', error);

// ✅ After
const log = createLogger('TemplateStorage');

log.debug({ templateId, userId, projectId }, 'Saving template');
log.error({ error, templateId }, 'Failed to save template');
```

## Debugging

### Enable Verbose Logging

```bash
# Set to debug level
LOG_LEVEL=debug

# Or trace for maximum detail
LOG_LEVEL=trace
```

### Filter by Module

Logs include `module` field for easy filtering:

```bash
# View only TemplateStorage logs
docker logs ecards-api 2>&1 | grep '"module":"TemplateStorage"'
```

### View Real-time Logs

```bash
# Follow logs from api-server
docker logs -f ecards-api

# With grep filtering
docker logs -f ecards-api 2>&1 | grep -i error
```

## Performance

- **Pino** is one of the fastest Node.js loggers (~10x faster than Winston)
- Async logging reduces I/O blocking
- JSON serialization optimized for performance
- Log rotation prevents disk space issues

## Migration from console.log

Completed files:
- ✅ `src/core/database/prisma.ts` - Disabled query logging
- ✅ `src/core/utils/logger.ts` - Created structured logger
- ✅ `src/features/template-textile/services/unifiedTemplateStorageService.ts`
- ✅ `src/features/batch-parsing/services/batchParsingService.ts`
- ✅ `src/core/cassandra/init.ts`
- ✅ `src/core/middleware/authMiddleware.ts`
- ✅ `src/app.ts`
- ✅ `src/server.ts`
- ✅ `src/core/cassandra/client.ts`

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable
2. Verify log level of your statement (e.g., `debug` won't show if `LOG_LEVEL=info`)
3. Check Docker container logs: `docker logs ecards-api`

### Too Verbose

```bash
# Reduce to warnings and errors only
LOG_LEVEL=warn
```

### Need More Detail

```bash
# Enable debug logging
LOG_LEVEL=debug

# Or enable Prisma query logging temporarily
# (Edit prisma.ts to add 'query' to log levels)
```

## References

- [Pino Documentation](https://getpino.io/)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
- [Log Levels Guide](https://getpino.io/#/docs/api?id=loggerlevel-string-gettersetter)
