# E-Cards (tools-ecards) — Foundation doc 04: Architecture foundation

**Brownfield synthesis:** 2026-04-27 — synthesized from code tree, DOCS_TECH_STACK.md, Docker compose, and feature docs. **Inference** items labeled until owner confirms.

---

## 1. Repository architecture

Monorepo with three application services and shared packages:

```
tools-ecards/
├── front-cards/          # Next.js 16 UI (App Router, RSC)
├── api-server/           # Fastify + Prisma API
├── render-worker/        # Background job processor (mock rendering)
├── db/                   # DB init scripts
│   ├── init-postgres/
│   └── init-cassandra/
├── packages/
│   └── shared-types/     # Shared TypeScript types
├── bin/                  # Host scripts (start.sh)
├── docker-compose.dev.yml
└── docker-compose.prd.yml
```

**Inference:** The `shared-types` package suggests cross-service type sharing, but actual adoption across all three services is unverified.

## 2. Service architecture

```
┌─────────────────────────────────────────────────────┐
│                    Internet                          │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│               front-cards (Next.js 16)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ App Router  │  │  API Routes  │  │ Auth (BFF) │ │
│  │  pages      │  │  (BFF)       │  │ OAuth/PKCE │ │
│  └─────────────┘  └──────┬───────┘  └─────┬──────┘ │
└──────────────────────────┼────────────────┼─────────┘
                           │                │
┌──────────────────────────▼────────────────▼─────────┐
│                 api-server (Fastify)                 │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │ Features │ │ Prisma   │ │ Redis  │ │  S3      │ │
│  │ (bounded │ │ (PG ORM) │ │ (Bull) │ │ (Seaweed)│ │
│  │ contexts)│ └──────────┘ └────────┘ └──────────┘ │
│  └──────────┘                                       │
└──────────┬──────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│            render-worker (mock rendering)             │
│  ┌────────────────────────────────────────────────┐ │
│  │  BullMQ consumer — card rendering (Canvas/Sharp)│ │
│  │  Status: mock — worker infra wired, rendering   │ │
│  │          logic is setTimeout placeholder         │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 3. Bounded contexts (api-server)

**Inferred from `api-server/src/features/` directory structure:**

| Context | Responsibility | Evidence |
|---------|---------------|----------|
| Auth | OAuth PKCE, cookie sessions, JWT, middleware | Feature doc + code |
| Templates | Card template CRUD, canvas data | Feature doc (template-textile) |
| Batches | Batch upload, parsing, records CRUD | Feature docs |
| Projects | Project CRUD, template-project association | Feature doc (simple-projects) |
| Fonts | Google Fonts proxy, custom font upload | Feature doc (font-management) |
| Storage | S3 presigned URLs, file upload/download | Feature doc (s3-bucket) |
| Dashboard | Dashboard route shell | Feature doc (dashboard) |

## 4. Data flow — batch generation (intended)

```
1. User designs template (front-cards canvas)
       │
2. User uploads recipient spreadsheet (front-cards → api-server)
       │
3. Records parsed and stored (api-server → PostgreSQL)
       │
4. User reviews records (front-cards → api-server)
       │
5. Batch generation triggered → BullMQ job (api-server → Redis)
       │
6. render-worker picks up job → generates cards (render-worker)
       │
7. Generated cards stored (render-worker → S3)
```

**Note:** Steps 5–7 are incomplete — render-worker rendering is mocked (setTimeout). Worker infra (BullMQ consumer + job handler + queue) is wired.

## 5. Database architecture

### PostgreSQL (relational — Prisma ORM)
- Users, subscriptions, templates
- Batches, cards metadata
- Financial/billing data

### Cassandra (event log — cql scripts)
- Event logs (card generation events)
- Audit trails
- High-write time-series data

**Inference:** The dual-database architecture suggests PostgreSQL for transactional data and Cassandra for high-volume event ingestion. The exact division of responsibility (what goes where) is not explicitly documented beyond feature docs.

## 6. Key ADRs

| ADR | Title | Status | File |
|-----|-------|--------|------|
| 001 | Monorepo architecture (3 apps + shared packages) | **Decided** | `.work/decisions/20260427-001-monorepo-architecture.md` |
| 002 | Dual database: PostgreSQL + Cassandra | **Decided** | `.work/decisions/20260427-002-dual-database-postgres-cassandra.md` |
| 003 | Next.js 16 App Router + RSC for frontend | **Decided** | `.work/decisions/20260427-003-nextjs-app-router.md` |
| 004 | Fastify + Prisma for API server | **Decided** | `.work/decisions/20260427-004-fastify-prisma.md` |
| 005 | Docker Compose for all services | **Decided** | `.work/decisions/20260427-005-docker-compose.md` |
| 006 | S3-compatible storage via SeaweedFS | **Decided** | `.work/decisions/20260427-006-seaweedfs-storage.md` |

## 7. Architecture risks

| Risk | Impact | Notes |
|------|--------|-------|
| Render worker rendering is mocked (infra exists) | High | Worker wiring complete; Canvas/Sharp rendering logic not implemented |
| Batch import placeholder | Medium | Post-parse mapping not wired |
| No explicit bounded-context boundaries in code | **Inference** | Feature-based folders exist but no strict domain isolation |
| OAuth dependency on external identity server | Medium | External auth server is a separate repo |
