# NEXT - planning backlog

**Updated:** 2026-07-16 (post M5 commit + operator feedback fixes)

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
| Clone-size diagnosis (2026-07-16) | Confirmed ignored local `node_modules` (~9GB+) and absent `.opencode` are not in git; GitHub ~3MB |
| Demo card-generation reliability fix | Font preload (`exportService.ts`, both modes); XLSX self-closing-cell regex bug + per-field name fallback (`demoSpreadsheetParser.ts`); legacy-cols/updateRecord field-loss fixes (`batchRecordService.ts`); verified against user's real `.xlsx` |
| Flexible field-mapping + import persistence | Fuzzy header fallback + phone/ext reconciliation (Demo + Normal); CSV/paste delimiter/header detection; import auto-persist via `templateService.saveTemplate`; `test_batch_parsing.py` |
| Paste parser + font reopen + import naming | KV/multi-section paste; work-phone-prefix; `fontService.preloadFontsForElements`; filename-based import names with `(n)` dedup; demo template upsert; jest 127 + python 22 |
| M5 x-director improvements | Playwright smoke + CI; render-worker PNG (text/shapes/images/QR); parser golden fixtures; ops runbook U6; TS gate; fake-indexeddb demo persistence test |
| Operator feedback intake (2026-07-16) | `.work/feedback/README.md`, `20260717-system-observations.md` (12 items from ODT) |
| Feedback fixes F1–F3, F7–F8, F10–F11 | Export height parity; render-retry API; RecordEditModal focus; 1076×380 defaults; home nav; steppers; multi-delete guard |

---

### Intake queue

- 2026-07-16 · cross-cutting · "Prepare prod deploy from tar.gz backups + Demo mode with browser-only persistence" → completed (M4)
- 2026-07-16 · feedback · F4–F6, F9, F12 → deferred (profile, capitalization, image shapes, units — need SPEC or owner confirm)

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| 1 | DNS/TLS ownership for prod hostname | Procedure documented; host still operator-owned |
| 2 | Clean public Demo deploy (both env flags) | Internet Demo cutover |
| 3 | Manual browser click-through (Demo export + import-persistence) | jest covers IndexedDB; live PNG/font still eng/owner |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | Manual browser click-through | Demo: upload `.xlsx`, batch export, confirm name+font on PNG; import design, close tab, reopen |
| **1** | Production deploy cutover | `./bin/start.sh prd up`; DNS/TLS; Demo flags on clean host |
| **2** | Promote deferred feedback (F9, F12) or start M6 | Image clip shapes; template units — feature SPEC first |
| **3** | Close residual M1/M2 gaps | Fabric parse TODO; batch-import placeholders |
| **4** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **5** | UI foundation (optional) | `@ui-design-foundation greenfield` when UI design work starts |

---

## Current iteration

*(none active — M5 complete 2026-07-16. Start M6 or feature SPEC with `@code-implementation plan`)*

### Completed — M5: x-director recommended improvements

**Status:** complete · **Completed:** 2026-07-16

| ID | Description | Status |
|----|-------------|--------|
| M5-T1 | Playwright E2E smoke scaffold + CI job (live `next start`) | done |
| M5-T2 | Render-worker Fabric JSON → PNG (text/shapes/images/QR + job storageUrl) | done |
| M5-T3 | Parser golden fixtures (Demo + Python parity) | done |
| M5-T4 | Ops runbook: diagnostics, monitoring, cutover checklist | done |
| M5-T5 | Front-cards TS errors fixed; coverage floor 30% interim | done |
| M5-T6 | fake-indexeddb demo template persistence unit test | done |
| M5-T7 | Render-status API returns storageUrl from completed jobs | done |

---

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
