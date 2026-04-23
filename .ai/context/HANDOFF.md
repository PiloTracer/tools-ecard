# HANDOFF — tools-ecards (E-Cards)

**Purpose:** One screen so a **new agent or human** can resume without prior chat. Depth lives in **`.claude/`** and `DOCS_CONTEXT.md`.

**Freshness:** Updated **2026-04-22**. After `git pull`, skim **§7** and run one check from **§4** before claiming a release.

### Last verified (update when you run checks)

| Area | Date | Notes |
|------|------|--------|
| Improvement plan work | 2026-04-22 | **Shipped:** `GET /api/batches/:id` in `batch-upload` (`getBatchDetail` + Cassandra `recordsCount`); **`batch-import`** registered at `/api/batch-import`** in `app.ts`; **removed** broken `api-server/src/features/template-designer/` tree. **Docs/plan:** `.claude/plans/20260422-ecards-application-improvement-priorities.md` and `.claude/features/render-worker/` updated. |
| Baseline CI / full build | _pending_ | Run **§4** after `npm ci` + `npm run db:generate` in `api-server`; local `tsc` had many **pre-existing** errors unrelated to the batch-detail change—use **CI log** as gate. |

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
3. **`.claude/DIRECTORY_MAP.md`** — plans, features, fixes.
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
| **Repo root** `.env` | Dev / local + **`docker-compose.dev.yml`** `api-server` (`env_file: .env`). Copy from **`.env.dev.example`**. **No** `api-server/.env`. |
| **Repo root** `.env.prd` | Production stack; copy from **`.env.prd.example`**. Gitignored. |
| **`api-server/scripts/preload-root-env.cjs`** | Loads repo-root `.env` for **Prisma CLI** and **Jest** when run from `api-server/`. App also loads root `.env` via config (see `api-server/src/core/config/`). |

**Compose / start:** `./bin/start.sh dev` uses root `.env` or `.env.dev` with `docker-compose.dev.yml`. Production: `docker compose --env-file .env.prd -f docker-compose.prd.yml …` (see root `README.md`).

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

From **`docker-compose.dev.yml`**:

| Container | Role |
|-----------|------|
| `ecards-frontend` | `front-cards` (7300 → 3000) |
| `ecards-api` | `api-server` (7400 → 4000); **env** from root **`env_file: .env`** |
| `ecards-postgres` | PostgreSQL (7432) |
| `ecards-cassandra` | Cassandra (7042) |
| `ecards-redis` | Redis (7379) |
| `ecards-render-worker` | `render-worker` |

Production stack: **`docker-compose.prd.yml`**, images build from **`Dockerfile.prd`** per service; nginx: **`deploy/nginx/ecards.prd.conf`**.

---

## 6) Where the real docs live

| Need | Path |
|------|------|
| Feature specs, plans, runbooks | **`.claude/`** |
| Stack one-pager | `DOCS_TECH_STACK.md` |
| Full architecture | `DOCS_CONTEXT.md` |
| Root pointers | `CONTEXT.md` |

Prefer **one** `.claude/features/<name>/` folder over re-reading all of `DOCS_CONTEXT.md`.

---

## 7) Open threads (optional — trim when stale)

- **`api-server` `npm run build` (tsc):** CI is intended to enforce this. If CI fails, triage from the log: missing `node_modules` / run `npm run db:generate`; per-route `AuthenticatedRequest` vs global `FastifyRequest['user']`; Prisma schema vs `Project` types; AWS SDK typings — **not** from memory. The obsolete **`api-server/src/features/template-designer/`** stub was **removed** (2026-04); do not resurrect unless intentionally reintroducing an alias to **template-textile**.
- **`batch-upload` `deleteBatch`:** Confirm whether deletes must also clear **Cassandra** batch records ( **`batch-view` service** had that path; verify parity with live **`batch-upload`** delete).
- **Do not paste** real `.env` / `.env.prd` contents into chats or handoff; use **`.env.*.example`** for key names only.

---

## 8) Cursor / rules (FAQ)

- **`.cursorrules`:** Cursor loads **workspace** rules from this file for agents working **in this repo**. It is not a separate “memory bank” that persists across unrelated projects; each workspace has its own rules file. New chats in **this** workspace still use `.cursorrules` when Cursor attaches workspace rules (same as other repo-local rule files under `.cursor/rules/` if present).
- **`.ai/context/HANDOFF.md`:** Resume aid for humans/agents; update **Last verified** and **§7** when you close a meaningful session.
