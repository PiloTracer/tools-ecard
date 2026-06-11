# E-Cards (tools-ecards) — Foundation doc 01: Initial scope

**Brownfield synthesis:** 2026-04-27 — synthesized from README, feature docs, code tree, and DOCS_TECH_STACK.md. **Inference** items labeled until owner confirms.

---

## 1. Product scope

E-Cards is a **digital card design and batch generation platform**. Users create visual card templates via a canvas-based designer, import recipient data via spreadsheets, and generate personalized cards at scale.

### Core capabilities (shipped or in-progress)

| Capability | Status | Evidence |
|------------|--------|----------|
| Canvas template designer (template-textile) | Shipped | `.work/features/from-claude/template-textile/` — Fabric.js canvas, text fields, QR codes, backgrounds, fonts |
| Simple projects API | Shipped | `.work/features/from-claude/simple-projects/` — `/api/v1/projects` |
| Batch upload & parsing | Shipped | `.work/features/from-claude/batch-upload/` + `batch-parsing/` — multipart upload, Bull queue, Python parser |
| Batch records CRUD | Shipped | `.work/features/from-claude/batch-records/` |
| S3-compatible storage | Shipped | `.work/features/from-claude/s3-bucket/` — SeaweedFS, presigned URLs |
| Font management | Shipped | `.work/features/from-claude/font-management/` — Google Fonts + upload |
| Authentication (OAuth/PKCE) | Shipped | `.work/features/from-claude/authentication/` |
| Batch view (frontend listing) | Shipped | `.work/features/from-claude/batch-view/` |
| Simple quick actions | Shipped | `.work/features/from-claude/simple-quick-actions/` |
| Dashboard shell | Shipped | `.work/features/from-claude/dashboard/` |
| Render worker | Mock implementation | `.work/features/from-claude/render-worker/` — BullMQ worker + job handler exist; actual Canvas/Sharp rendering logic is mocked (`setTimeout`). Worker infra is wired. |
| Batch import (mapping) | Placeholder | `.work/features/from-claude/batch-import/` — routes mounted at `/api/batch-import`; controller returns placeholder responses |
| Batch records edit | **Inference:** not complete | Legacy plan exists at `.work/plans/proposals/from-claude/FEATURE_BATCH_RECORDS_EDIT.md` |

## 2. Audience (Inference)

**Inferred from feature set** — not explicitly documented in README:

| Segment | Description | Priority |
|---------|-------------|----------|
| Card designers / template creators | Users who design card templates visually | Primary |
| Batch operators | Users who upload recipient lists and trigger batch generation | Primary |
| Administrators | Users managing fonts, projects, dashboard | Secondary |

## 3. In scope (confirmed from code)

- Visual card template creation and editing (canvas-based)
- Text, image, QR code, and background management on cards
- Font management (Google Fonts API + custom upload)
- Batch recipient data upload (CSV/XLSX via multipart)
- Batch record CRUD (view, edit individual records)
- S3-compatible object storage for templates and assets
- OAuth 2.0 / PKCE authentication with cookie sessions
- Project-based organization of templates
- Dashboard shell for navigation

## 4. Out of scope (explicit per feature docs)

- Batch import post-parse mapping service (placeholder — routes ARE mounted at `/api/batch-import`, controller returns placeholder)
- Full card rendering logic (worker infra exists: BullMQ consumer + job handler; actual Canvas/Sharp rendering is mocked)
- `api-server/src/features/template-designer/` (removed — superseded by `template-textile`)
- User profile management beyond auth (feature-only doc at `.work/features/from-claude/user-profile.md`)

## 5. Technology stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16, React 19, Tailwind CSS, Fabric.js | App Router, RSC |
| API | Fastify (Node.js) + Prisma ORM | REST + WebSocket |
| Database | PostgreSQL 16 (relational), Cassandra 5 (event log) | |
| Queue | Redis 7 + Bull/BullMQ | Job processing |
| Storage | S3-compatible (SeaweedFS) | Presigned URLs |
| Rendering | Canvas/Sharp (render-worker, mock) | Worker infra exists; rendering logic is mocked | |
| Auth | OAuth 2.0 (PKCE), HTTP-only cookies, JWT | |
| LLM | OpenAI, Anthropic, DeepSeek (where configured) | In api-server |
| Container | Docker Compose (dev + prod) | 7 services |

## 6. Assumption ledger

| ID | Assumption | Label | Source | Notes |
|----|-----------|-------|--------|-------|
| A1 | Primary segment is card designers + batch operators | **Inference** | Feature docs | Not explicitly stated in README |
| A2 | Render worker needs rendering logic implemented (infra exists — BullMQ worker + job handler wired, rendering mocked) | **Confirmed** | Code audit: `render-worker/src/worker.ts` + `jobs/render-card.ts` exist | |
| A3 | The project uses monorepo layout with 3 apps + packages | **Confirmed** | Code tree | front-cards, api-server, render-worker, packages/shared-types |
| A4 | All services run in Docker for development | **Confirmed** | docker-compose.dev.yml, DOCS_TECH_STACK.md | |

## 7. Risks (new)

| ID | Risk | Severity | Notes |
|----|------|----------|-------|
| R1 | Render worker has mock rendering — worker infra exists but Canvas/Sharp logic not implemented | High | Blocks end-to-end batch generation |
| R2 | Batch import placeholder — post-parse mapping not wired | Medium | Affects complete batch workflow |
| R3 | No CI/CD pipeline documented | Medium | Pipeline design is open unknown (U2 in UNKNOWNS) |

## 8. Known unknowns

| ID | Question | Source |
|----|---------|--------|
| U1 | Is the project in active development or maintenance mode? | **Inference:** active (recent .claude migration) |
| U2 | What is the production deployment target? | Remote server ref at `.work/docs/from-claude-remote-server/` suggests dev.aiepic.app |
