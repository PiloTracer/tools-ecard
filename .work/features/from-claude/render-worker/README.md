# Render worker

BullMQ worker process that consumes **`card-rendering`** jobs from Redis.

## Current implementation (2026-04)

- **Entry:** `render-worker/src/worker.ts` — registers a BullMQ `Worker` on queue name `card-rendering`.
- **Job handler:** `render-worker/src/jobs/render-card.ts` — **stub**: logs job payload, simulates delay; TODO list in file for real canvas/storage/DB integration.
- **Config:** `render-worker/src/core/config/index.ts` — includes `worker.renderEngine` defaulting to **`canvas`** via `RENDER_ENGINE` env (not yet read by the stub handler).
- **Queue connection:** `render-worker/src/core/queue/index.ts`

## Dependencies (package vs code)

`render-worker/package.json` includes **`canvas`**, **`sharp`**, and **`qrcode`**, intended for a **Node-side** render path. As of this writing, **no production TypeScript in `render-worker/src` imports those modules**; they are **prepared but unused** until the handler is implemented. **Puppeteer is not** a declared dependency of `render-worker`.

## Where rendering exists today (browser)

**Server/worker does not yet produce card images.** The working export path is **client-side** in **front-cards**:

- **Fabric.js** editor: `features/template-textile/components/Canvas/DesignCanvas.tsx`
- **PNG/JPG/SVG** from the on-screen canvas: `features/template-textile/components/Canvas/CanvasControls.tsx` (`toDataURL`, etc.)
- **Off-screen export** (template JSON → Fabric → bitmap): `features/template-textile/services/exportService.ts`, `features/template-textile/services/canvasRenderer.ts`, batch ZIP in `batchExportService.ts`

Priority 2 / worker implementation should **reuse or mirror** that template JSON and layout behavior (Node `canvas`, headless Chromium, or hybrid), not reinvent it in isolation.

## Operations

Run via Docker Compose service for `render-worker` (see repo `DOCS_TECH_STACK.md` for service name and ports).

## Related docs

- [feature.yaml](feature.yaml) — paths and queue name
- [render-worker.md](render-worker.md) — short pointer / history
