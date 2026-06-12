# Diagnostics — Queue & Worker Monitoring

## Overview

Diagnostic endpoints for monitoring the batch parsing queue and worker health. These are operational tools for troubleshooting, not user-facing features.

## Endpoints

### `GET /api/diagnostics/queue-stats`

Returns queue statistics and worker status for the batch parsing pipeline.

**Response:**
```json
{
  "success": true,
  "data": {
    "queue": {
      "waiting": 0,
      "active": 0,
      "completed": 42,
      "failed": 1,
      "delayed": 0
    },
    "worker": {
      "working": false,
      "totalCompleted": 42,
      "totalFailed": 1
    },
    "timestamp": "2026-06-12T00:00:00.000Z"
  }
}
```

### `GET /api/diagnostics/redis-status`

Checks Redis connectivity by querying the queue.

**Response (healthy):**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "host": "redis",
    "port": 6379
  }
}
```

**Response (unhealthy):**
```json
{
  "success": false,
  "data": {
    "connected": false,
    "error": "Connection refused"
  }
}
```

## Usage

```bash
# Check queue health
curl http://localhost:7400/api/diagnostics/queue-stats

# Check Redis connectivity
curl http://localhost:7400/api/diagnostics/redis-status
```

## Location

- **Routes:** `api-server/src/features/batch-parsing/routes/diagnostics.fastify.ts`
- **Registered in:** `api-server/src/app.ts` under prefix `/api/diagnostics`
- **Auth:** Protected by global `authMiddleware` — token required

## Related

- Batch parsing worker: `.work/features/from-claude/batch-parsing/README.md`
- Queue service: `api-server/src/features/batch-upload/services/queueService.ts`
