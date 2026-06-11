# Directory Map — tools-ecards

**Status:** Binding. Project-specific supplement to `.ai/standards/20260517-DIRECTORY_MAP.md`.

---

## Repository roots

| Path | Purpose |
|------|---------|
| `front-cards/` | Next.js 16 UI (React Server Components, App Router) |
| `api-server/` | Fastify + Prisma API server |
| `render-worker/` | Background job processing (Bull/BullMQ, Canvas/Sharp rendering) |
| `db/` | PostgreSQL and Cassandra init scripts |
| `packages/shared-types/` | Shared TypeScript types and packages |
| `bin/` | Host scripts (`start.sh`, `start_cron.sh`) |
| `.ai/` | Agnostic: skills, standards, concepts, workflow guides |
| `.work/` | Project: plans, SPECs, ADRs, prompts, session HANDOFF, docs |

## Application layout

```
tools-ecards/
├── api-server/                     # Fastify + Prisma API
│   ├── package.json
│   ├── prisma/                     # Prisma schema + migrations
│   ├── src/
│   │   ├── server.ts
│   │   ├── features/               # Bounded contexts
│   │   ├── core/                   # Shared cross-cutting code
│   │   └── shared/                 # Shared utilities
│   └── tests/
├── front-cards/                    # Next.js 16 UI
│   ├── package.json
│   ├── app/                        # App Router pages
│   ├── components/
│   └── tests/
├── render-worker/                  # Background job processor
│   └── src/
├── db/
│   ├── init-postgres/              # PostgreSQL init scripts
│   └── init-cassandra/             # Cassandra CQL scripts
├── packages/
│   └── shared-types/               # Shared TypeScript packages
├── bin/                            # Host scripts
├── docker-compose.dev.yml          # Local dev stack
├── docker-compose.prd.yml          # Production stack
└── DOCS_TECH_STACK.md              # Pinned stack versions
```

## Docker service map

| Compose service | Container name suffix | Purpose |
|-----------------|----------------------|---------|
| `postgres` | `-postgres` | PostgreSQL 16 (relational data) |
| `cassandra` | `-cassandra` | Cassandra 5 (event/log data) |
| `redis` | `-redis` | Redis 7 (queue broker + cache) |
| `frontend` | `-frontend` | Next.js 16 UI |
| `api` | `-api` | Fastify API server |
| `render-worker` | `-render-worker` | Background job processor |
| `db-init` | `-db-init` | DB initialization |

Stack identity: `TD_STACK_SUFFIX` env var (default `_dev_tcrd`).

## Dependency rule

Bounded contexts (`api-server/src/features/`) import only `core/`, `shared/`, and `packages/shared-types`. Cross-context integration via events and ports only.
