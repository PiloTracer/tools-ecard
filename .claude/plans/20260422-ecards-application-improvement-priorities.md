# E-Cards application improvement priorities

**Date:** 2026-04-22  
**Scope:** tools-ecards monorepo (front-cards, api-server, render-worker)  
**Audience:** Engineering leads and implementers  

This plan captures the **three highest-impact** improvement tracks derived from current architecture, feature documentation under `.claude/features/`, and known gaps (duplicate batch APIs, stub worker, unmounted import).

---

## Priority 1 — Unify and harden the batch HTTP surface

**Problem:** The UI targets **`/api/batches`** for list, stats, delete, and batch detail. **batch-upload** is registered on that prefix and covers upload, list, status, retry, stats, and recent, but **does not** expose a dedicated **`GET /api/batches/:batchId`** full-detail contract that matches **`batch-view`**’s alternate Fastify module (which exists but is **not** registered in `api-server/src/app.ts`). That split risks **404s, duplicated logic, and drift** between `features/batch-view` on the client and the live server.

**Direction:**

- Pick a **single owner** for `/api/batches` (either extend **batch-upload** with missing read operations or register **batch-view** with a clear merge strategy—never two plugins fighting the same paths).
- Align **response shapes** with `front-cards/features/batch-view/services/batchViewService.ts` expectations.
- Document the final contract in `.claude/features/batch-view/feature.yaml` and `.claude/features/batch-upload/feature.yaml` after the change.

**Success criteria:**

- One registered Fastify tree for `/api/batches` with no duplicate route definitions.
- Batch list, stats, delete, status, and **batch detail** (if required by UI) all work against **api-server** in dev compose with passing smoke or integration checks.

---

## Priority 2 — Implement the real card render pipeline (render-worker)

**Problem:** **`render-worker`** consumes **`card-rendering`** jobs but **`processRenderCard`** is still a **stub** (simulated delay, TODO list for template fetch, layout, export, S3 upload, persistence). Without this, batches and templates do not deliver finished assets—the core product outcome.

**Direction:**

- Define job payload and idempotency (template id, record id, batch id, output keys).
- Integrate **template-textile** data (PostgreSQL / APIs), **batch-records** / Cassandra reads, and **s3-bucket** for inputs and outputs.
- Implement rendering (node-canvas, Puppeteer, or agreed stack), retries, and structured failure reporting; update **`.claude/features/render-worker/`** as behavior lands.

**Success criteria:**

- A job enqueued from the app (or a test harness) produces a **stored artifact** (e.g. PNG) in the configured bucket and a **verifiable job status** path (DB or API) suitable for UI polling.

---

## Priority 3 — Wire batch import and reduce dead or misleading code

**Problem:** **batch-import** has Fastify routes in code but **is not registered** in `app.ts`, so the field-mapping / import step remains **non-functional** at the HTTP layer. Separately, **`api-server/src/features/template-designer/`** is a **broken stub** (imports paths that do not exist under that folder), which confuses navigation and onboarding.

**Direction:**

- Register **batch-import** under a **non-conflicting prefix** (for example `/api/batch-import`, as already reflected in feature docs), connect to real persistence when requirements are clear, and keep placeholder responses only behind an explicit flag if needed.
- Either **delete** the stray **template-designer** folder or replace it with a one-line re-export from **template-textile** only if the team wants a compatibility alias—avoid leaving broken trees in `src/features/`.
- Add minimal E2E or API tests for import preview/mapping once the first real step ships.

**Success criteria:**

- `app.ts` documents and registers batch-import; **OpenAPI or feature.yaml** matches live routes.
- No `api-server` feature directory that fails to resolve imports on a clean checkout.

---

## Suggested sequencing

1. **Priority 1** first — unblocks correct dashboard and batch UX and reduces production risk on every batch-related change.  
2. **Priority 2** in parallel where staffing allows — largest product delta but depends on stable data and storage contracts (often easier after batch API clarity).  
3. **Priority 3** once batch reads are trustworthy — import builds on parsed records and clear batch identity.

---

## References

- `.claude/features/batch-view/README.md` — API split and registration note  
- `.claude/features/batch-import/README.md` — mount status  
- `.claude/features/render-worker/README.md` — worker and stub status  
- `.claude/features/template-textile/README.md` — note on `template-designer` stub folder  
