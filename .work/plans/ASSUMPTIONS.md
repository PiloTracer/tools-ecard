# ASSUMPTIONS - planning registry

**Updated:** 2026-07-16 · **Maintained by:** plan-foundation / plan-master / session-control

Label every entry: **Confirmed** | **Inference** | **Unverified** | **Rejected**

| ID | Assumption | Label | Source | Notes |
|----|------------|-------|--------|-------|
| A1 | Primary users are card designers + batch operators | **Inference** | Foundation doc 01 | Not explicitly stated in README |
| A2 | Dev workflow follows Docker Compose | **Confirmed** | `docker-compose.dev.yml` | Services: postgres, cassandra, redis, front-cards, api-server, render-worker, db-init |
| A3 | Render worker needs fuller Fabric→canvas rendering | **Confirmed** | `render-worker/src/services/renderer.ts` | Canvas used; Fabric JSON parse still TODO |
| A4 | Project uses TypeScript strict mode | **Confirmed** | `.work/standards/CONVENTIONS.md` | Enforced per conventions |
| A5 | Monorepo with 3 apps + shared packages | **Confirmed** | Code tree | front-cards, api-server, render-worker, packages/shared-types |
| A6 | Missing CI/CD is acceptable | **Rejected** | `.github/workflows/ci.yml` | CI exists (was Unverified via U2) |
| A7 | Batch import mapping still incomplete at HTTP layer | **Confirmed** | `batchImportController.ts` | Service may exist; controller still returns placeholder messages |

## Rejected

| ID | Assumption | Reason |
|----|------------|--------|
| A6 | Missing CI acceptable | CI workflow present |

## Review log

| Date | Reviewer | Action |
|------|----------|--------|
| 2026-04-27 | brownfield synthesis | Initial population |
| 2026-07-16 | session context verify | A6 rejected; A3/A7 reworded to match current code |
