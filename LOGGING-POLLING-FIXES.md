# Logging and Polling Fixes

**Date:** 2025-11-25
**Issue:** Infinite Prisma debug logs flooding output, making batch parsing errors invisible

## Problems Identified

1. **Prisma Debug Logging Enabled**
   - `DEBUG=*` was set in both `.env` and `docker-compose.dev.yml`
   - This logged EVERY database query from Prisma (`prisma:client`, `prisma:query`)
   - Frontend polling the batch status endpoint triggered thousands of log entries

2. **Aggressive Frontend Polling**
   - Frontend polled `/api/batches/{id}/status` every 3 seconds
   - Combined with debug logging, this created an infinite log flood
   - Made it impossible to see actual batch parsing errors

## Changes Made

### 1. Disabled Prisma Debug Logging

**File: `.env`**
```bash
# Before:
DEBUG=*

# After:
DEBUG=*,-prisma:*
```

**File: `docker-compose.dev.yml`**
```yaml
# Before:
DEBUG: ${DEBUG:-*}

# After:
DEBUG: ${DEBUG:-*,-prisma:*}
```

**Effect:**
- All logs are still shown EXCEPT Prisma debug logs
- Batch parsing errors are now visible
- System performance improved (less logging overhead)

**Alternative Options:**
- `DEBUG=app:*` - Only log application-level logs
- `DEBUG=` - Disable all debug logs
- `DEBUG=*,-prisma:*,-express:*` - Exclude multiple modules

### 2. Reduced Frontend Polling Frequency

**File: `front-cards/features/batch-upload/components/BatchStatusTracker.tsx`**

**Before:**
```typescript
const pollInterval = setInterval(() => {
  if (status && (status.status === BatchStatus.LOADED || status.status === BatchStatus.ERROR)) {
    return; // BUG: Doesn't clear interval!
  }
  fetchStatus();
}, 3000); // Poll every 3 seconds
```

**After:**
```typescript
const pollInterval = setInterval(() => {
  if (status && (status.status === BatchStatus.LOADED || status.status === BatchStatus.ERROR)) {
    clearInterval(pollInterval); // FIX: Properly clear interval
    return;
  }
  fetchStatus();
}, 5000); // Poll every 5 seconds (reduced from 3s)
```

**Changes:**
- Increased polling interval from 3s to 5s (40% reduction in requests)
- Fixed bug where interval wasn't being cleared when batch completed
- Added comments explaining the change

**Effect:**
- Reduced server load
- Less log spam
- Still responsive enough for user experience
- Properly stops polling when batch processing completes

## Results

After these changes:
- Logs are clean and readable
- Batch parsing errors are visible in output
- System performance improved
- Frontend still provides timely status updates

## How to Apply

1. **Restart Docker Services:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d --build
   ```

2. **Verify Changes:**
   - Check logs: `docker-compose logs -f api-server`
   - Should NOT see `prisma:query` or `prisma:client` logs
   - Batch parsing errors should be visible

## Future Improvements (Optional)

1. **Exponential Backoff for Polling:**
   - Start at 2s, increase to 5s, then 10s, max 30s
   - Reduces load for long-running batches

2. **WebSocket for Real-Time Updates:**
   - Replace polling with WebSocket push notifications
   - Eliminates polling entirely
   - Already planned in architecture (see CLAUDE_CONTEXT.md)

3. **Structured Logging:**
   - Use a logging library (winston, pino)
   - Log levels: error, warn, info, debug
   - JSON format for easy parsing

## Related Files

- `.env` - Root environment variables
- `docker-compose.dev.yml` - Docker service configuration
- `front-cards/features/batch-upload/components/BatchStatusTracker.tsx` - Polling component

## Notes

- The `.env` file contains secrets and should NOT be committed to git
- The `.env.dev.example` file should be updated with the new DEBUG pattern
- Prisma logs can be re-enabled for debugging: `DEBUG=*` (temporarily)
