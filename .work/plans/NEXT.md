# NEXT - planning backlog

**Updated:** 2026-06-11

---

## Done

| Item | Artifact |
|------|----------|
| Agent OS bootstrap | `.work/` skeleton, `.cursorrules` from template |
| .claude → .work migration | All content migrated: features, plans, fixes, implementations, prompts, specs, tutorials, analysis, remote_server_reference |
| .cursorrules configured | All REPLACE tokens resolved to project paths |
| .work/docs/ populated | Project-specific standards, directory map, remote server reference, tutorials |
| .claude archived | Renamed to `.claude.deprecated/` with `.gitignore` entry |
| @plan-repair brownfield (foundation) | Doc 01 (scope) + doc 04 (architecture) synthesized; 6 ADRs written |
| @plan-repair brownfield (master) | Draft master plan with M1-M3 milestones; registries populated |
| @plan-master integrity | Phase 5 pass with waivers; plan-master-ready: yes |
| @plan-master continue → Approved | Master plan set to Approved; sections 20–25 + appendices added |
| Backup/Restore fix in `bin/start.sh` | Fixed production volume names, stopped-stack consistency, stripped config-file backup, added CLI `restore` command |

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| - | (none) | |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | Deploy production stack | `cp .env.prd.example .env.prd`, verify OAUTH_CLIENT_SECRET, `./bin/start.sh prd up` |
| **1** | Resolve render-worker Prisma client in dev | Pre-existing Alpine vs Debian lib conflict — works in production (Debian) |
| **2** | Set up monitoring | Prometheus/Grafana/Sentry — nothing configured |
| **3** | Wire automated backups | `bin/start_cron.sh` exists, no host cron or k8s CronJob wired |

---

## Current iteration - M3: Hardening & infrastructure

**Milestone ref:** M3 · `{MASTER_PLAN}` §19
**Status:** complete
**Started:** 2026-04-27

### In scope
- Document operations runbook
- Document threat model from existing architecture knowledge
- Verify health endpoint completeness
- Add render-worker tests (currently passWithNoTests)

### Out of scope (explicit)
- CI pipeline setup (already exists in `.github/workflows/ci.yml`) ✅
- Health endpoint (already exists at `GET /health`) ✅
- New features beyond hardening

### Tasks
| ID | Description | Files | Status | Notes |
|----|-------------|-------|--------|-------|
| M3-T1 | Establish CI pipeline | `.github/workflows/ci.yml` | done — pre-existing | 5-job CI already in place (compose-sanity, api-server, render-worker, front-cards, shared-types) |
| M3-T2 | Add unit/integration test coverage | `api-server/tests/`, `render-worker/tests/`, `.github/workflows/ci.yml`, `render-worker/jest.config.js` | done 2026-04-27 | Render-worker: Jest config with coverage thresholds, storage unit test, CI coverage reporting enabled |
| M3-T3 | Add structured metrics and health endpoints | `api-server/src/app.ts` | done — pre-existing | `GET /health` returns status, timestamp, env, storage integration status |
| M3-T4 | Document runbooks for ops | `.work/docs/runbooks/operations-runbook.md` | done 2026-04-27 | Covers stack lifecycle, health checks, common issues, port map, deployment |
| M3-T5 | Threat model review | `.work/docs/standards/threat-model.md` | done 2026-04-27 | STRIDE analysis for 5 trust boundaries; high-risk areas identified |

### Acceptance criteria
- [ ] Operations runbook covers: stack start/stop, health check, log access, common failures
- [ ] Threat model identifies key surfaces: auth, S3 access, batch data, render pipeline
- [ ] Health endpoint documented in runbook

### Validation steps
- [ ] Tests: `docker compose exec api bash -c "cd /app && npm test"`
- [ ] Lint: `docker compose exec frontend bash -c "cd /app && npm run lint"`
- [ ] Type: `docker compose exec api bash -c "cd /app && tsc --noEmit"`

### Owner blockers
- U2 (CI platform choice) is now moot — GitHub Actions CI already exists

### Concept / NFR registry (this iteration)
| Concept id | Applies | Status | Evidence / trigger |
|------------|---------|--------|-------------------|
| MOD-01 | no | skip | No cost-model change |
| MOD-02 | no | skip | No new coupling surfaces |
| MOD-03 | no | skip | No new modular boundaries |
| MOD-04 | no | skip | No distribution change |
| MOD-05 | yes | pending | Runbooks affect ops headcount |
| MOD-06 | yes | pending | AI-assisted session |

### Cross-LLM verification
- Triggered: no

### Done this iteration
| Task | Completed | Notes |
|------|-----------|-------|
| M3-T1 | pre-existing | Full CI pipeline with 5 jobs (compose-sanity, api-server, render-worker, front-cards, shared-types) |
| M3-T3 | pre-existing | `GET /health` endpoint returns status, timestamp, env, storage status |
| M3-T4 | 2026-04-27 | Operations runbook covering stack lifecycle, health checks, common issues |
| M3-T5 | 2026-04-27 | Threat model with STRIDE analysis across 5 trust boundaries |
| M3-T2 | 2026-04-27 | Jest config with coverage, storage service unit test, CI coverage reporting enabled |

