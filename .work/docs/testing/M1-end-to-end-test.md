# M1 End-to-End Test Procedure

**Milestone:** M1 — Render worker & card generation pipeline
**Date:** 2026-04-27
**Status:** Test procedure documented

## Prerequisites

- Docker Compose stack running (`bin/start.sh dev up` or `docker compose -f docker-compose.dev.yml up -d`)
- All 7 services healthy: `postgres`, `cassandra`, `redis`, `frontend`, `api`, `render-worker`, `db-init`
- A template exists in the template-textile designer (Fabric.js canvas)
- A batch with records exists (can be created through the batch upload UI)

## Test Steps

### 1. Verify render-worker is running

```bash
docker compose logs render-worker
# Expected: "Render worker ready (env=development, concurrency=4)"
```

### 2. Verify S3 connectivity

```bash
# Check that the render-worker's S3 config can reach SeaweedFS
# SeaweedFS should be running as part of the stack (or configured externally)
docker compose exec api bash -c "curl -s http://seaweedfs:9333/cluster/health" || echo "SeaweedFS health check"
```

### 3. Trigger a card render

The render is triggered when a batch record reaches the rendering stage. In the current implementation:

1. Navigate to `/batches` in the frontend
2. Select a batch with parsed records
3. Click "Generate Cards" (or equivalent render trigger button)
4. This should enqueue a `card-rendering` BullMQ job

### 4. Monitor render progress

```bash
# Check render-worker logs for rendering activity
docker compose logs -f render-worker
# Expected:
#   🎨 Rendering card: { templateId, recordId, batchId }
#   ✅ Card rendered: {recordId} ({width}x{height}, {size}KB)
#   📤 Card uploaded to S3: {bucket}/{key}
```

### 5. Verify render status via API

```bash
# Replace :batchId and :recordId with actual values
curl -s http://localhost:7400/api/batches/:batchId/records/:recordId/render-status
# Expected:
#   { "success": true, "data": { "status": "completed", "progress": 100 } }
```

### 6. Verify S3 upload

```bash
# Check that the rendered card is in SeaweedFS
# Replace :bucket and :key with values from render-worker logs
curl -s -I http://localhost:8333/:bucket/:key
# Expected: HTTP 200 with content-type image/png
```

### 7. Verify frontend status badge

1. Navigate to `/batches/:batchId/records` in the frontend
2. During rendering: records should show a blue spinning badge with "Rendering X%"
3. After completion: badge should show green "Rendered" checkmark
4. On failure: badge should show red "Failed" with error tooltip

### 8. Verify generated card is viewable/downloadable

1. After render completes, click on a record with "Rendered" badge
2. The record detail should show a preview of the generated card
3. A download button should provide the card image

## Expected Results

| Step | Expected outcome |
|------|-----------------|
| Worker startup | Logs show "Render worker ready" |
| S3 connectivity | SeaweedFS responds to health check |
| Render trigger | BullMQ job enqueued on `card-rendering` queue |
| Render execution | Worker logs: render → upload pipeline completes |
| Status API | Returns `completed` with `progress: 100` |
| S3 upload | File exists at expected path in SeaweedFS |
| Frontend badge | Shows "Rendered" green badge |
| Card preview | PNG image visible in record detail |

## Known Limitations

1. Template JSON parsing is not yet implemented — rendered output is a placeholder canvas (white + dimensions label)
2. QR code rendering not yet wired (qrcode package installed but unused)
3. Font management not yet integrated into render pipeline
4. No presigned URL generation in render-worker yet

## Rollback

If the render pipeline fails:
1. Check render-worker logs for error details
2. Verify Redis connection (`docker compose logs redis`)
3. Verify database connection (`docker compose logs postgres`)
4. Verify SeaweedFS connection
5. Jobs will auto-retry up to 3 times with exponential backoff
