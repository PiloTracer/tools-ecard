# tools-ecards — at-a-glance

Use this file for **30-second orientation**. For details, follow the links (do not duplicate long specs here).

| What | Where |
|------|--------|
| **Rules for agents** | [`.cursorrules`](.cursorrules) |
| **Cursor MCP (project)** | [`.cursor/mcp.json`](.cursor/mcp.json) — loaded automatically when this folder is the workspace root ([docs](https://cursor.com/docs/mcp)) |
| **Stack, ports, Docker, commands** | [`DOCS_TECH_STACK.md`](DOCS_TECH_STACK.md) |
| **Full system doc** | [`DOCS_CONTEXT.md`](DOCS_CONTEXT.md) |
| **Resume / handoff** | [`.ai/context/HANDOFF.md`](.ai/context/HANDOFF.md) |
| **Feature list & depth** | [`.claude/FEATURES_INDEX.md`](.claude/FEATURES_INDEX.md) and [`.claude/features/`](.claude/features/) |
| **`.claude` layout** | [`.claude/DIRECTORY_MAP.md`](.claude/DIRECTORY_MAP.md) |
| **Conventions** | [`.claude/CONVENTIONS.md`](.claude/CONVENTIONS.md) |
| **Feature doc standard** | [`.claude/FEATURE_STANDARD.md`](.claude/FEATURE_STANDARD.md) |
| **Human quick start** | [`README.md`](README.md) |
| **CI (build / test / compose sanity)** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| **Production stack** | `docker-compose.prd.yml` + `.env.prd` + per-service `Dockerfile.prd` (suffix is **`prd`**, not `prod`) |
| **Identity / OAuth (Tools Dashboard)** | Sibling repo **`../tools-dashboard`** — compose + nginx in [`DOCS_TECH_STACK.md`](DOCS_TECH_STACK.md) under *External Services* |

**Apps:** `front-cards/` (Next.js) · `api-server/` (Fastify + Prisma) · `render-worker/` (jobs).

**Env:** monorepo root **`.env`** (local dev, final) / **`.env.prd`** (prod); templates **`.env.dev.example`**, **`.env.prd.example`** only. No per-app env files (`api-server/.env`, **`api-server/.env.example`**, `front-cards/.env.local`). `front-cards` loads root env via Docker `env_file` or `scripts/preload-root-env.cjs` for host `npm run dev`. See **`.ai/context/HANDOFF.md` §3**.

**Default compose:** `docker compose -f docker-compose.dev.yml up` (see `DOCS_TECH_STACK.md` for URLs).
