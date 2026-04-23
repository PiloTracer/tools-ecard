# Render worker

BullMQ worker process that consumes **`card-rendering`** jobs from Redis.

## Current implementation (2026-04)

- **Entry:** `render-worker/src/worker.ts` — registers a BullMQ `Worker` on queue name `card-rendering`.
- **Job handler:** `render-worker/src/jobs/render-card.ts` — **stub**: logs job payload, simulates delay; TODO list in file for real canvas/storage/DB integration.
- **Config:** `render-worker/src/core/config/index.ts`
- **Queue connection:** `render-worker/src/core/queue/index.ts`

## Dependencies

- **Redis** — same queue ecosystem as `api-server` batch queues.
- **Future:** templates, batch records, S3 output, and persistence will tie this worker to **template-textile**, **batch-records**, and **s3-bucket**.

## Operations

Run via Docker Compose service for `render-worker` (see repo `DOCS_TECH_STACK.md` for service name and ports).

## Related docs

- [feature.yaml](feature.yaml) — paths and queue name
- [render-worker.md](render-worker.md) — short pointer / history
