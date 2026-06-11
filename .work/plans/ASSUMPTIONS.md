# ASSUMPTIONS - planning registry

**Updated:** 2026-04-27 · **Maintained by:** plan-foundation / plan-master

Label every entry: **Confirmed** | **Inference** | **Unverified** | **Rejected**

| ID | Assumption | Label | Source | Notes |
|----|------------|-------|--------|-------|
| A1 | Primary users are card designers + batch operators | **Inference** | Foundation doc 01 | Not explicitly stated in any README |
| A2 | Dev workflow follows Docker Compose (7 services) | **Confirmed** | `.cursorrules`, docker-compose.dev.yml | All services containerized |
| A3 | Render worker needs rendering logic (infra exists: BullMQ Worker + job handler wired, rendering mocked) | **Confirmed** | Code audit: `render-worker/src/worker.ts` + `jobs/render-card.ts` | M1 reduced scope — replace mock, not build from scratch |
| A4 | Project uses TypeScript strict mode | **Confirmed** | CONVENTIONS.md | Enforced per project conventions |
| A5 | Monorepo with 3 apps + shared packages | **Confirmed** | Code tree | front-cards, api-server, render-worker, packages/shared-types |
| A6 | Missing CI/CD is acceptable for current dev workflow | **Unverified** | UNKNOWNS U2 | Pipeline design is open |
| A7 | Batch import mapping is placeholder (routes ARE mounted at /api/batch-import, controller returns placeholder) | **Confirmed** | Code audit: `api-server/src/app.ts` registers batchImportRoutesFastify | M2 reduced scope — replace controller logic, not build routes |

## Rejected

| ID | Assumption | Reason |
|----|------------|--------|
| - | (none) | |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population from code + feature docs |
