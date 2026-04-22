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

**Apps:** `front-cards/` (Next.js) · `api-server/` (Fastify + Prisma) · `render-worker/` (jobs).

**Default compose:** `docker compose -f docker-compose.dev.yml up` (see `DOCS_TECH_STACK.md` for URLs).
