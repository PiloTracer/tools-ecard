# E-Cards application improvement priorities

**Plan date:** 2026-04-22  
**Last updated:** 2026-04-22 (end-of-session sync for handoff / resume)  
**Scope:** tools-ecards monorepo (`front-cards`, `api-server`, `render-worker`)  
**Audience:** Engineers and agents resuming work  

**Handoff pointer:** [`.ai/context/HANDOFF.md`](../../.ai/context/HANDOFF.md) §0 — same status in shorter form.

---

## Executive summary (state for the next session)

| Track | Done already | Still to do |
|-------|----------------|-------------|
| **P1** Batch HTTP | **`GET /api/batches/:id`** on **batch-upload** returns `{ batch }` (Prisma + Cassandra `recordsCount`). Route order preserves `/stats`, `/recent` before param `/:id`. | Remove or merge duplicate **`api-server/src/features/batch-view/`** (unregistered). Tests / smoke. Optional: **`deleteBatch`** Cassandra parity vs old batch-view logic. |
| **P2** Render worker | Docs updated: stub handler; **`canvas`/`sharp`/`qrcode`** in worker `package.json` unused in `src/`; **Fabric** export is the **live** client path. | Choose stack; implement **`processRenderCard`**; enqueue + **job status** (DB/API); S3 artifact. |
| **P3** Batch import + cleanup | **`batch-import`** registered **`/api/batch-import`** in `app.ts`. Broken **`api-server/src/features/template-designer/`** removed. | Real import/mapping logic; tests. |

---

## Priority 1 — Unify and harden the batch HTTP surface

### Original problem

The UI (`front-cards/features/batch-view/`) calls **`NEXT_PUBLIC_API_URL`** + **`/api/batches`**. Only **batch-upload** was registered; **`GET /api/batches/:id`** for batch **detail** was missing while the client expected **`BatchResponse` (`{ batch }`)**. A second implementation lived under **`api-server/src/features/batch-view/`** but was **never** registered on `app.ts`.

### Completed (2026-04-22)

| Item | Location |
|------|-----------|
| **`GET /api/batches/:id`** | `api-server/src/features/batch-upload/routes.fastify.ts` (registered **after** `GET /stats` and `GET /recent`) |
| **Service** | `api-server/src/features/batch-upload/services/batchUploadService.ts` — **`getBatchDetail(userId, batchId)`** uses `batchRepository.findByUserIdAndId` + **`batchRecordRepository.getRecordCountByBatchId`** |
| **Docs** | `.claude/features/batch-upload/feature.yaml`, `.claude/features/batch-view/README.md`, `.claude/FEATURES_INDEX.md` |

### Remaining work

1. **Duplicate module:** Either delete **`api-server/src/features/batch-view/`** or merge any unique logic into **batch-upload**, then drop dead code. Today it only adds confusion.
2. **Contract tests:** Add API test or smoke: `GET /api/batches/<uuid>` → 200 + `{ batch }` for owned batch; 404 for other user.
3. **Delete semantics:** If production requires Cassandra cleanup on batch delete, align **`batchUploadService.deleteBatch`** with the approach in **`batchViewService.deleteBatch`** (Cassandra + Postgres) and test.

### Success criteria (checklist)

- [x] Single registered Fastify tree for **`/api/batches`** (still **batch-upload** only).
- [x] **`GET /api/batches/:id`** returns shape compatible with **`batchViewService.fetchBatch`** (`{ batch }`).
- [ ] Duplicate **`batch-view`** server package resolved (removed or merged).
- [ ] Automated test or documented manual smoke for batch detail.

---

## Priority 2 — Implement the real card render pipeline (render-worker)

### Problem (unchanged core)

**`render-worker`** subscribes to BullMQ queue **`card-rendering`**, but **`render-worker/src/jobs/render-card.ts`** only **stubs** work (sleep + logs). **No** PNG is written; **no** S3 upload; **no** job status persistence.

### Facts to reuse (do not ignore)

| Fact | Implication |
|------|----------------|
| **`render-worker/package.json`** lists **`canvas`**, **`sharp`**, **`qrcode`** | Intended **Node-side** rendering; **not wired** in TS yet. |
| **`RENDER_ENGINE`** in `render-worker/src/core/config/index.ts` defaults to **`canvas`** | Config exists; handler does not branch on it yet. |
| **No Puppeteer** in render-worker dependencies | If you pick Chromium, add dep + container story explicitly. |
| **`front-cards`** already exports cards via **Fabric.js** | **`exportService.ts`**, **`canvasRenderer.ts`**, **`CanvasControls.tsx`**. Server implementation should **mirror template JSON + layout** or call a shared package—avoid a second incompatible layout engine without a plan. |

### Recommended next steps (tomorrow)

1. **Decision (record in PR):** **Node `canvas`** (port Fabric layout logic / shared lib) vs **headless browser** vs **“enqueue from client export”** hybrid—pick one MVP.
2. **Job contract:** Freeze `RenderCardJob` fields (`templateId`, `recordId`, `batchId`, output key, user id, retry token).
3. **Minimal vertical slice:** One job → load template + record → render PNG buffer → **s3-bucket** upload → status row or Redis hash → UI or admin can verify.
4. **Docs:** Update `.claude/features/render-worker/` after the first non-stub commit.

### Success criteria

- [ ] Job processed without stub sleep path producing a **real file** in object storage (or agreed staging path).
- [ ] **Observable status** (API or DB) for poll/UX.
- [ ] Retries / failure message surfaced for ops.

---

## Priority 3 — Wire batch import and reduce dead or misleading code

### Original problem

**batch-import** had Fastify routes but was **not** mounted. **`api-server/src/features/template-designer/`** was invalid (broken imports).

### Completed (2026-04-22)

| Item | Location |
|------|-----------|
| **Mount batch-import** | `api-server/src/app.ts` — `app.register(batchImportRoutesFastify, { prefix: '/api/batch-import' })` |
| **Example paths** | `.claude/features/batch-import/feature.yaml` — `/api/batch-import/:id/import`, `preview`, `mappings/suggest`, `validate`, `status`, `cancel` |
| **Remove template-designer stub** | Directory **`api-server/src/features/template-designer/`** removed (files + empty dirs) |
| **Docs** | `.claude/features/batch-import/README.md`, flat `batch-import.md`, `template-textile/README.md` |

### Remaining work

1. Replace **placeholder** responses in **`batchImportService`** with real behavior tied to **parsed batches** and **batch-records**.
2. **Tests** when first non-mock endpoint ships.
3. **Front-cards:** Wire UI to **`/api/batch-import`** when product is ready (today may still be unused in UI).

### Success criteria

- [x] `app.ts` registers batch-import; **feature.yaml** matches live prefix.
- [x] No broken **`template-designer`** tree under `api-server/src/features/`.
- [ ] Non-placeholder import/mapping behavior + tests.

---

## Suggested sequencing (updated)

1. **Close Priority 1** — remove/merge **`api-server/batch-view`**, confirm delete/Cassandra behavior, add tests. Low risk, clears mental load.
2. **Priority 2 MVP** — in parallel once P1 cleanup is stable enough not to churn batch APIs while render work needs batch/template IDs.
3. **Priority 3 product logic** — after stable **batch detail** and **records** contracts; import UX depends on knowing batch + column state.

---

## Tomorrow starter checklist (copy-friendly)

- [ ] Read [`.ai/context/HANDOFF.md`](../../.ai/context/HANDOFF.md) §0.
- [ ] `git pull` and run **one** verification from handoff **§4** (or trust CI on your branch).
- [ ] Open **`api-server/src/app.ts`** — confirm **`/api/batch-import`** and **`/api/batches`** registrations.
- [ ] If working **P1:** open **`api-server/src/features/batch-view/`** and decide delete vs merge; grep references.
- [ ] If working **P2:** open **`render-worker/src/jobs/render-card.ts`** + **`front-cards/.../exportService.ts`** side by side.
- [ ] If working **P3:** open **`api-server/src/features/batch-import/services/batchImportService.ts`** and define first real use case (e.g. preview from Cassandra).

---

## References (authoritative paths)

| Topic | Path |
|-------|------|
| Batch list / detail / upload (live) | `.claude/features/batch-upload/README.md`, `feature.yaml` |
| Batch UI client | `.claude/features/batch-view/README.md` |
| Batch import HTTP | `.claude/features/batch-import/README.md`, `feature.yaml` |
| Render worker + Fabric context | `.claude/features/render-worker/README.md`, `feature.yaml` |
| Template editor / export | `.claude/features/template-textile/README.md`, `template-textile-core.md` |
| Feature index | `.claude/FEATURES_INDEX.md` |
| Deep dive upload/parse | `.claude/features/BATCH_UPLOAD_AND_PARSING.md` |

---

**Document owner:** Engineering (update **Last updated** and checkboxes when progress lands.)
