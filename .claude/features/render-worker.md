# Render-worker

**Status:** Worker process runs; **job handler is stubbed** (see `render-worker/src/jobs/render-card.ts`).  
**Canonical docs:** [render-worker/README.md](render-worker/README.md) and [render-worker/feature.yaml](render-worker/feature.yaml)

## What exists today

- BullMQ worker on queue **`card-rendering`** (`render-worker/src/worker.ts`).
- Config and Redis connection under `render-worker/src/core/`.
- `processRenderCard` simulates work only; real rendering, storage upload, and DB updates are TODO.

## Planning context

Historical phase planning: [feature-order.md](feature-order.md).
