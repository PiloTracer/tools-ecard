# HANDOFF — tools-ecards (E-Cards)

**Purpose:** One screen so a **new agent or human** can resume without prior chat. Depth lives in **`.claude/`** and `DOCS_CONTEXT.md`.

**Freshness:** Updated **2026-04-28**. After `git pull`, skim **§7** and run one check from **§4** before claiming a release.

**Session closed 2026-04-28 — template-textile / designer canvas:** **Bring** in **Canvas elements** modal now re-adds Fabric objects when store and canvas are out of sync (`requestCanvasRebindForElementIds` in `canvasStore.ts`, consumed at start of sync in `DesignCanvas.tsx`, called from `ElementsLayerManagerModal.tsx`). **Canvas resize:** dispose cleanup clears `addedElementIds` / `fabricObjectsMap` (and related refs); sync lock is **`globalSyncLockRef`** (not `useState`); sync effect deps include **`width`/`height`** so elements re-add after dimension-only changes; canvas init uses **`useLayoutEffect`** + immediate zoom/size from store; cleanup calls **`setFabricCanvas(null)`**. **UI:** Elements button + modal strings moved to **English** (`CanvasControls.tsx`, `ElementsLayerManagerModal.tsx`). **Suggested commit subject:** `fix: canvas Bring rebind + English Elements modal` (or split if you commit resize separately). **Not re-run here:** full `front-cards` `npm run build` / CI — treat CI as gate.

**Session closed 2026-04-25:** Seaweed/Tools Dashboard storage work and tutorials landed (see **Last verified** row below). No open blocker from that track; next owner picks up from **§0** / **§7** as usual.

### Last verified (update when you run checks)

| Area | Date | Notes |
|------|------|--------|
| Template designer (Fabric) — canvas / modal | 2026-04-28 | **Code:** `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx`, `ElementsLayerManagerModal.tsx`, `CanvasControls.tsx`; `stores/canvasStore.ts` (rebind queue). **Verify in browser:** resize canvas with existing elements; open **Elements** → **Bring** on “no object on canvas” rows. **Unverified here:** `front-cards` full build (repo `tsc` has unrelated noise). |
| Improvement plan work | 2026-04-22 | **Shipped:** `GET /api/batches/:id` in `batch-upload` (`getBatchDetail` + Cassandra `recordsCount`); **`batch-import`** registered at `/api/batch-import` in `app.ts`; **removed** broken `api-server/src/features/template-designer/` tree. **Docs/plan:** `.claude/plans/20260422-ecards-application-improvement-priorities.md` and `.claude/features/render-worker/` updated. |
| Baseline CI / full build | _pending_ | Run **§4** after `npm ci` + `npm run db:generate` in `api-server`; local `tsc` had many **pre-existing** errors unrelated to the batch-detail change—use **CI log** as gate. |
| Stack identity / `.env` | 2026-04-25 | `TD_APP_CODE` / `TD_STACK_SUFFIX` / `COMPOSE_PROJECT_NAME=tools_dashboard_*_tcrd`; **`bin/start.sh`**, compose, and **`init-cassandra.sh`** use `-p` + service names. `.claude/fixes` / some runbooks may still show old `ecards-*` container names — use compose exec. |
| Seaweed + Tools Dashboard storage | 2026-04-25 | **Code:** `api-server/src/core/storage/index.ts` (contract), `…/integrations/appLibraryStorageIntegration.ts` (GET + `resolvePublicObjectUrl` + `STORAGE_USE_DASHBOARD_PUBLIC_BASE` / `STORAGE_PUBLIC_BUCKETS`). **Compose:** `docker-compose.dev.yml` / `prd` — `api-server` gets dashboard + storage vars + `NEXT_PUBLIC_API_URL`; `render-worker` dev has `host.docker.internal` + default Seaweed port **18333**. **Fixes:** batch Python spawn uses bucket default **`repositories`**, passes `SEAWEEDFS_REGION`; template `s3://` → HTTP uses **`appConfig.publicApi.baseUrl`**. **Docs:** `.claude/tutorials/STORAGE_SEAWEED_AND_TOOLS_DASHBOARD_INTEGRATION.md`, `SEAWEEDFS_S3_INTEGRATION_FOR_EXTERNAL_APPS.md`; **`.claude/DIRECTORY_MAP.md`** lists `tutorials/`. **Unverified here:** full `npm run build` / CI green. |

---

## 0) Start here tomorrow — improvement plan (2026-04-22)

**Primary plan:** [`.claude/plans/20260422-ecards-application-improvement-priorities.md`](../.claude/plans/20260422-ecards-application-improvement-priorities.md)

| Priority | Status (end of 2026-04-22) | Next concrete step |
|----------|---------------------------|---------------------|
| **1** Batch HTTP | **Partially done** — `GET /api/batches/:id` live on **batch-upload**; duplicate **`api-server/.../batch-view/`** Fastify module still **unregistered** | Decide: delete `batch-view` api package or merge; add smoke/API test for batch detail; verify `deleteBatch` vs Cassandra parity if deleting batches matters |
| **2** Render pipeline | **Open** — `render-worker` job handler still **stub**; **`canvas`/`sharp`/`qrcode`** in worker `package.json` **unused** in `src/` | Read **`.claude/features/render-worker/README.md`**; choose stack (node-canvas parity with Fabric vs headless Chromium); define job payload + status API/table |
| **3** Batch import | **Partially done** — routes **live** at `/api/batch-import`; responses still **placeholder** | Implement real import/mapping against parsed batches; tests |

**Feature docs index:** [`.claude/FEATURES_INDEX.md`](../.claude/FEATURES_INDEX.md) (13 feature areas; includes **authentication**, **simple-quick-actions**).

**Browser reference for server render:** `front-cards/features/template-textile/services/exportService.ts`, `canvasRenderer.ts`, `components/Canvas/CanvasControls.tsx` (Fabric — today’s real export path).

---

## 1) Read first (order)

1. **`.cursorrules`** — project rules, protected areas, verify-before-done, no cross-repo assumptions.
2. **`DOCS_TECH_STACK.md`** — services, ports, containers, commands (canonical).
3. **`.claude/DIRECTORY_MAP.md`** — plans, features, fixes, **`tutorials/`** (Seaweed + external-app S3 guides).
4. **`.claude/plans/20260422-ecards-application-improvement-priorities.md`** — if you are continuing the improvement track.
5. **`.claude/FEATURES_INDEX.md`** → **`.claude/features/<name>/`** on demand.
6. **`DOCS_CONTEXT.md`** — broad / cross-cutting architecture only.
7. **This file** — resume pointers only; keep **short**; no secrets.

---

## 2) What this repo is

**E-Cards:** `front-cards` (Next 16) → `api-server` (Fastify, Prisma, Cassandra, Redis, etc.) → PostgreSQL / Cassandra / Redis; `render-worker` for background jobs. Remote OAuth, SeaweedFS/S3, LLMs are **clients** — see `DOCS_CONTEXT.md` and **`.claude/features/`**.

**Naming:** Production artifacts use the suffix **`prd`** (e.g. `docker-compose.prd.yml`, `Dockerfile.prd`, `.env.prd`), **not** `prod`.

---

## 3) Environment files (single source of truth)

| File | Role |
|------|------|
| **Repo root** `.env` | **Preferred** local dev + Docker **`env_file`** for **`api-server`**, **`front-cards`**, etc. (`docker-compose.dev.yml`). Copy from **`.env.dev.example`**. Set **`TD_APP_CODE`**, **`TD_STACK_SUFFIX`**, **`COMPOSE_PROJECT_NAME`** (see example — `tools_dashboard_*_tcrd`). **No** `api-server/.env` or `front-cards/.env.local`. |
| **Repo root** `.env.dev` | Optional alternate for **`bin/start.sh`** compose interpolation when `.env` is missing; host `npm run dev` in `front-cards/` may load it via **`front-cards/scripts/preload-root-env.cjs`** only if `.env` does not exist. Docker `env_file` still expects **`.env`** at repo root for dev containers — keep `.env` present or symlink it to your active file. |
| **Repo root** `.env.prd` | Production stack; copy from **`.env.prd.example`**. Gitignored. **`docker-compose.prd.yml`** `front-cards` uses `env_file: .env.prd`. |
| **`api-server/scripts/preload-root-env.cjs`** | Loads repo-root `.env` for **Prisma CLI** and **Jest** when run from `api-server/`. App also loads root `.env` via config (see `api-server/src/core/config/`). |
| **`front-cards/scripts/preload-root-env.cjs`** | Before **`next dev` / `next build` / `next start`**, loads repo-root **`.env`** (or **`.env.dev`** if `.env` missing). Same keys as Docker dev when you use root `.env`. |

**Compose / start:** `./bin/start.sh dev` uses root `.env` if present, else `.env.dev`, for compose `--env-file`. Production: `docker compose --env-file .env.prd -f docker-compose.prd.yml …` (see root `README.md`).

---

## 4) Quick verification (after pull / before ship)

```bash
# Compose merges (no secrets in chat — use your local .env files)
cp .env.dev.example .env && docker compose -f docker-compose.dev.yml --env-file .env config >/dev/null
cp .env.prd.example .env.prd && docker compose -f docker-compose.prd.yml --env-file .env.prd config >/dev/null

# API (host; requires clean npm install + prisma generate)
cd api-server && npm ci && npm run db:generate && npm run build && npm test

# Frontend
cd front-cards && npm ci && npm run build
```

**CI:** `.github/workflows/ci.yml` — compose sanity, `api-server` / `render-worker` / `front-cards` / `shared-types` builds and tests on push/PR. Treat CI as the gate if local env is flaky.

**Feature smoke:** `test-simple-projects.sh` when simple-projects changed — see script header.

Update the **Last verified** table when you run these for real.

---

## 5) Docker dev (names that matter)

**Compose project / volumes** come from **`.env`**: `COMPOSE_PROJECT_NAME` = `tools_dashboard` + `TD_STACK_SUFFIX` (e.g. `tools_dashboard_dev_tcrd`).

| Compose **service** | Container name pattern (example dev) | Role |
|---------------------|--------------------------------------|------|
| `front-cards` | `tools_dashboard_dev_tcrd-frontend` | Next (7300 → 3000) |
| `api-server` | `…-api` | API (7400 → 4000); **env** root **`.env`** |
| `postgres` | `…-postgres` | PostgreSQL (7432) |
| `cassandra` | `…-cassandra` | Cassandra (7042) |
| `redis` | `…-redis` | Redis (7379) |
| `render-worker` | `…-render-worker` | worker |

**Exec by service (no hardcoded container):** `docker compose -p "$COMPOSE_PROJECT_NAME" -f docker-compose.dev.yml --env-file .env exec api-server …` (see **`./bin/start.sh`** which passes `-p`).

Production stack: **`docker-compose.prd.yml`**, images from **`Dockerfile.prd`**; nginx: **`deploy/nginx/ecards.prd.conf`**; container prefix `tools_dashboard_prd_tcrd-*` when using default **`.env.prd.example`**.


---

## 6) Where the real docs live

| Need | Path |
|------|------|
| Feature specs, plans, runbooks | **`.claude/`** |
| Seaweed / storage integration tutorials | **`.claude/tutorials/`** |
| Stack one-pager | `DOCS_TECH_STACK.md` |
| Full architecture | `DOCS_CONTEXT.md` |
| Root pointers | `CONTEXT.md` |

Prefer **one** `.claude/features/<name>/` folder over re-reading all of `DOCS_CONTEXT.md`.

---

## 7) Open threads (optional — trim when stale)

- **Template-textile designer (2026-04-28):** If you touch `DesignCanvas.tsx` again, smoke **canvas resize** (elements stay visible) and **Elements → Bring** for desynced rows; confirm **CI** for `front-cards` if you change exports or Fabric paths.
- **`api-server` `npm run build` (tsc):** CI is intended to enforce this. If CI fails, triage from the log: missing `node_modules` / run `npm run db:generate`; per-route `AuthenticatedRequest` vs global `FastifyRequest['user']`; Prisma schema vs `Project` types; AWS SDK typings — **not** from memory. The obsolete **`api-server/src/features/template-designer/`** stub was **removed** (2026-04); do not resurrect unless intentionally reintroducing an alias to **template-textile**.
- **`batch-upload` `deleteBatch`:** Confirm whether deletes must also clear **Cassandra** batch records ( **`batch-view` service** had that path; verify parity with live **`batch-upload`** delete).
- **Do not paste** real `.env` / `.env.prd` contents into chats or handoff; use **`.env.*.example`** for key names only.

---

## 8) Cursor / rules (FAQ)

- **`.cursorrules`:** Cursor loads **workspace** rules from this file for agents working **in this repo**. It is not a separate “memory bank” that persists across unrelated projects; each workspace has its own rules file. New chats in **this** workspace still use `.cursorrules` when Cursor attaches workspace rules (same as other repo-local rule files under `.cursor/rules/` if present).
- **`.ai/context/HANDOFF.md`:** Resume aid for humans/agents; update **Last verified** and **§7** when you close a meaningful session.
