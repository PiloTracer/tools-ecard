# HANDOFF — tools-ecards (E-Cards)

**Purpose:** One screen of context for a **new agent or human session** so work can continue without prior chat. For depth, use **`.claude/`** and `DOCS_CONTEXT.md`.

**Freshness:** This file is a snapshot. After pulling main, re-check **“Last verified”** and re-run a quick test from §4 if you are about to ship a change.

### Last verified (update when you run checks)

| Area | Date | Notes |
|------|------|--------|
| Baseline commands | _pending_ | Record `npm test` / `build` you actually ran in §4 |

---

## 1) Read first (order)

1. **`.cursorrules`** — project rules, protected areas, no assumptions from other repos.
2. **`DOCS_TECH_STACK.md`** — services, ports, containers, one-line commands.
3. **`.claude/DIRECTORY_MAP.md`** — where plans, features, and fixes live.
4. **`.claude/FEATURES_INDEX.md`** — feature catalog; then drill into **`.claude/features/<name>/`** as needed.
5. **`DOCS_CONTEXT.md`** — full architecture (load when the task is broad or cross-cutting).
6. **This file** — only for quick resume; keep it **short**; do not paste large specs here.

---

## 2) What this repo is

Browser-based **E-Cards** designer and batch processing: `front-cards` (Next 16) → `api-server` (Fastify, Prisma, etc.) → PostgreSQL / Cassandra / Redis; `render-worker` for background jobs. S3/SeaweedFS and external OAuth are **clients of remote services** — see `DOCS_CONTEXT.md` and **`.claude/features/`**.

**Workspace path (this clone):** use your actual path (often something like `.../tools-ecards`).

---

## 3) Docker (names that matter)

From **`docker-compose.dev.yml`** (adjust if compose changes):

| Container (typical) | Role |
|---------------------|------|
| `ecards-frontend` | Next.js `front-cards` (host 7300 → 3000) |
| `ecards-api` | `api-server` (host 7400 → 4000) |
| `ecards-postgres` | PostgreSQL (host 7432) |
| `ecards-cassandra` | Cassandra (host 7042) |
| `ecards-redis` | Redis (host 7379) |
| `ecards-render-worker` | `render-worker` |

---

## 4) Quick verification (after pulls / before claiming done)

Adjust to your environment (host `npm` vs `docker exec` — **DOCS_TECH_STACK.md** is canonical).

```bash
# Example: API unit tests (from host, if node_modules present)
cd api-server && npm test

# Example: run tests inside API container
docker exec ecards-api bash -c "cd /app && npm test"
```

**Frontend typecheck** (if `tsc` script exists in `front-cards/package.json`):

```bash
cd front-cards && npx tsc --noEmit
```

**Feature-specific smoke:** `test-simple-projects.sh` (simple-projects API) when that area changed — see script header in repo root.

Record the commands and results in **“Last verified”** when you use this handoff seriously.

---

## 5) Where the real docs live

- **Product / feature specs, plans, runbooks, ADRs:** **`.claude/`** (this is the authoritative doc tree for the current project).
- **Long architecture narrative:** `DOCS_CONTEXT.md`.
- **Stack cheat sheet:** `DOCS_TECH_STACK.md`.
- **At-a-glance pointer file:** `CONTEXT.md` in repo root.

When starting a new task, prefer **one feature folder** under `.claude/features/` over re-reading the entire `DOCS_CONTEXT.md`.

---

## 6) Keep this file lean

- Do not paste long investigation notes or secrets here.
- One or two **current** threads only (optional bullet list you update when closing a session):

  - *Example:* _Working on template-textile export — see `.claude/features/template-textile/`_.

If this section grows past ~10 lines, move the detail to **`.claude/plans/`** or a feature doc and put a **pointer** here only.
