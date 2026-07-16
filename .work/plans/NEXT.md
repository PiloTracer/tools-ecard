# NEXT - planning backlog

**Updated:** 2026-07-16 (post-M4 verify close)

---

## Done

| Item | Artifact |
|------|----------|
| Agent OS bootstrap | `.work/` skeleton, `.cursorrules` |
| .claude → .work migration | features, plans, fixes, implementations |
| @plan-repair / @plan-master | Foundation + Approved master plan M1–M3 |
| Backup/Restore + prod readiness | `bin/start.sh`, compose/env hardening |
| Thin-client migration | Removed vendored `.ai/` / `.ai.ui`; source pointers; `.work/standards/`; carriers reconciled |
| M4 Demo + prd restore | SPEC, ADR 007, Demo adapters, API write guard, runbook, `bin/verify-prd-env.sh` |
| M4 post-verify fixes | Demo batch export + package export paths; BFF proxy test; jest `maxWorkers:1` |

---

### Intake queue

- 2026-07-16 · cross-cutting · "Prepare prod deploy from tar.gz backups + Demo mode with browser-only persistence" → completed (M4)

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| 1 | U6 `/api/diagnostics` docs | Optional fold into ops runbook |
| 2 | DNS/TLS ownership for prod hostname | Procedure documented; host still operator-owned |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | Production deploy cutover | `./bin/start.sh prd up` (fresh or restore); DNS/TLS; confirm health. For Demo: both flags + empty volumes |
| **1** | Close residual M1/M2 gaps | Fabric parse TODO; batch-import placeholders |
| **2** | Document `/api/diagnostics` (U6) | Or fold into ops runbook |
| **3** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **4** | UI foundation (optional) | `@ui-design-foundation greenfield` when UI design work starts |

---

## Current iteration

*(none active — M4 complete 2026-07-16. Start a new iteration with `@code-implementation plan - M{N}` or feature SPEC before coding.)*

### Prior iteration — M4: Demo mode + production restore-from-backup (complete)

**Milestone ref:** M4 · **SPEC:** `.work/features/demo-local-persistence/20260716-SPEC.md`  
**Status:** complete · **Completed:** 2026-07-16

| ID | Description | Status |
|----|-------------|--------|
| M4-T1 | Ops: prd restore-from-backup runbook + env verify helper | done |
| M4-T2 | Demo mode detection + provider + `/demo` + banner | done |
| M4-T3 | Browser store layer (localStorage + IndexedDB) | done |
| M4-T4 | Demo adapters: projects + templates + resources | done |
| M4-T5 | Demo adapters: fonts + batches/records (render mocked) | done |
| M4-T6 | Auth bypass + api-server DEMO_MODE write guard | done |
| M4-T7 | Tests + lint/tsc + MOD-06 + CHANGELOG | done |
| M4-verify | Public-Demo barriers (apiClient + Next BFF) | done |
