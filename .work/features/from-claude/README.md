# Features directory

**Purpose:** Authoritative feature documentation for the E-Cards (tools-ecards) monorepo. Read on demand; start from the index below.

**Last verified against codebase:** 2026-04-27 (brownfield audit)

---

## Canonical feature packages (README + feature.yaml)

These map directly to shipped or in-progress code under `front-cards`, `api-server`, and `render-worker`. Legacy index at `.claude.deprecated/FEATURES_INDEX.md`.

| Directory | Scope |
|-----------|--------|
| [template-textile/](template-textile/README.md) | Canvas template designer (Fabric.js), backgrounds, QR, fonts |
| [simple-projects/](simple-projects/README.md) | Projects API (`/api/v1/projects`), default project, selection |
| [batch-upload/](batch-upload/README.md) | Multipart upload, batch list/status/delete/retry, stats, recent |
| [batch-parsing/](batch-parsing/README.md) | Bull worker, Python parser integration, `/api/batch-records` search APIs, diagnostics |
| [batch-records/](batch-records/README.md) | CRUD for records under `/api/batches/:batchId/records` |
| [batch-view/](batch-view/README.md) | Frontend batch listing and navigation |
| [batch-import/](batch-import/README.md) | Post-parse import / mapping (placeholder; routes mounted at `/api/batch-import`, controller returns placeholder) |
| [s3-bucket/](s3-bucket/README.md) | S3-compatible storage (SeaweedFS), presigned URLs |
| [font-management/](font-management/README.md) | Google Fonts and upload APIs |
| [dashboard/](dashboard/README.md) | Dashboard route shell |
| [render-worker/](render-worker/README.md) | BullMQ `card-rendering` worker (mock rendering — worker infra exists, Canvas/Sharp logic is mocked) |
| [authentication/](authentication/README.md) | Next.js auth routes, `AuthProvider`, cookies; API `authMiddleware` |
| [simple-quick-actions/](simple-quick-actions/README.md) | Dashboard quick actions (project-gated); composes batch-upload |

---

## Consolidated / deep-dive specs

| File | Use when |
|------|-----------|
| [BATCH_UPLOAD_AND_PARSING.md](BATCH_UPLOAD_AND_PARSING.md) | End-to-end upload → queue → Python parse → storage (long-form) |

---

## Authentication (detailed specs)

| File | Notes |
|------|--------|
| [authentication/README.md](authentication/README.md) | **Canonical** map of routes, context, and middleware |
| [auto-auth.md](auto-auth.md) | Long-form OAuth / integration spec |
| [auto-auth.external.md](auto-auth.external.md) | External system contracts |

---

## Legacy flat specs (planning / partial)

These files predate the `*/README.md` + `feature.yaml` layout. Prefer the **directory** in the first table when both exist.

| File | Prefer instead |
|------|----------------|
| [simple-projects.md](simple-projects.md) | [simple-projects/](simple-projects/README.md) |
| [s3-bucket.md](s3-bucket.md) | [s3-bucket/](s3-bucket/README.md) |
| [template-designer.md](template-designer.md) | [template-textile/](template-textile/README.md) |
| [batch-import.md](batch-import.md) | [batch-import/](batch-import/README.md) |
| [render-worker.md](render-worker.md) | [render-worker/](render-worker/README.md) |
| [batch-management.md](batch-management.md) | Overlaps **batch-view** + **batch-upload**; no dedicated package yet |
| [name-parser.md](name-parser.md) | Implemented inside **batch-parsing** (LLM name parsing), not a standalone service |
| [user-profile.md](user-profile.md) | Not implemented as a dedicated feature area |
| [database-setup.md](database-setup.md) | Reference for Prisma / DB; schema lives in `api-server/prisma` |

---

## Implementation order (historical)

[feature-order.md](feature-order.md) is a **2025 planning** timeline (phases, dependency graph). It is useful for context but **does not** reflect current completion state; use per-feature READMEs and `feature.yaml` files for what exists today.

---

## Undocumented features (code exists, no feature doc)

| Feature | Location | Notes |
|---------|----------|-------|
| Diagnostics / queue monitoring | `api-server` routes at `/api/diagnostics` | Worker queue monitoring endpoints; no feature README |
| template-designer (api-server) | `api-server/src/features/template-designer/` | All subdirs empty — **deprecated/removed**. Superseded by `template-textile` |

## Conventions

Feature doc structure was defined in `.claude.deprecated/FEATURE_STANDARD.md`. The Agent OS standard is at `.ai/standards/20260517-FEATURE_STANDARD.md`.
