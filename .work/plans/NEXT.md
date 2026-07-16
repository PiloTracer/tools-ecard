# NEXT - planning backlog

**Updated:** 2026-07-16

---

## Done

| Item | Artifact |
|------|----------|
| Agent OS bootstrap | `.work/` skeleton, `.cursorrules` |
| .claude → .work migration | features, plans, fixes, implementations |
| @plan-repair / @plan-master | Foundation + Approved master plan M1–M3 |
| Backup/Restore + prod readiness | `bin/start.sh`, compose/env hardening |
| Thin-client migration | Removed vendored `.ai/` / `.ai.ui`; source pointers; `.work/standards/`; carriers reconciled |

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| 1 | U3 active-dev vs maintenance | Affects whether NEXT priority 0 is deploy vs feature work |
| 2 | U4 production deployment target | Hosting / DNS / TLS ownership |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | Confirm U3/U4 (owner) then deploy or feature | If shipping: `cp .env.prd.example .env.prd`, verify `OAUTH_CLIENT_SECRET`, `./bin/start.sh prd up` |
| **1** | Close residual M1/M2 gaps | Fabric parse TODO in `render-worker/src/services/renderer.ts`; batch-import placeholder responses |
| **2** | Document `/api/diagnostics` (U6) | Or fold into ops runbook |
| **3** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **4** | UI foundation (optional) | `@ui-design-foundation greenfield` when UI design work starts |

---

## Current iteration

*(none active — M3 complete. Start a new iteration with `@code-implementation plan - M{N}` or feature SPEC before coding.)*

### Prior iteration — M3: Hardening & infrastructure (complete)

**Milestone ref:** M3 · `{MASTER_PLAN}` §19  
**Status:** complete · **Started:** 2026-04-27

| ID | Description | Status |
|----|-------------|--------|
| M3-T1 | CI pipeline | done — `.github/workflows/ci.yml` |
| M3-T2 | Test coverage | done — render-worker Jest thresholds 40% + CI `--coverage` |
| M3-T3 | Health endpoints | done — `GET /health` |
| M3-T4 | Ops runbook | done — `.work/docs/runbooks/operations-runbook.md` |
| M3-T5 | Threat model | done — `.work/standards/threat-model.md` (also under `.work/docs/standards/`) |

### Acceptance criteria (M3)

- [x] Operations runbook covers stack start/stop, health, logs, common failures
- [x] Threat model covers auth, S3, batch data, render pipeline
- [x] Health endpoint documented in runbook

### Validation steps (re-run when coding)

```bash
docker compose -f docker-compose.dev.yml exec api-server bash -c "cd /app && npm test"
docker compose -f docker-compose.dev.yml exec front-cards bash -c "cd /app && npm run lint"
docker compose -f docker-compose.dev.yml exec api-server bash -c "cd /app && tsc --noEmit"
```
