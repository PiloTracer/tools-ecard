# NEXT - planning backlog

**Updated:** 2026-08-14 (UI cycle S0–S4 committed/pushed + both sessions closed; next = prd/demo redeploy + browser click-through)

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
| Feedback F4–F6/F9/F12 (2026-07-16) | Profile + subscription UI; ingest-only person-name capitalize; image clip shapes; canvas units; api-server jest runner |
| `.cursorrules` thin-client verify (2026-08-11) | Path-migration audit green (all pointers/skills/local refs resolve; `soc-deploy-basic verify` + `deploy-basic status` PASS); stale `nginx` compose row + SOC fallback inconsistency flagged |
| Import-ux + templates (2026-08-12) | Passes 0–6 implemented + gate-verified (baseline hardening, template XLSX, transposed parsing, `.vcf` import, field-mapping + presets, template kinds, role-gated globals, e2e/docs) — `.work/plans/20260812-import-ux-templates-plan.md` §9 |
| Demo KV-paste field-mapping fix (2026-08-12) | Unknown-label KV paste lines no longer dropped (mapping modal auto-opens); `telefono_trabajo`/`extension_trabajo` aliases; fuzzy exact-token-priority (correo/direccion heuristic); both parsers, parity kept; front 311 / api 207+3 / python 67 green |
| OAuth log-scrub + drop-and-go bundled templates (2026-08-12) | Auth secrets/PII redacted from frontend OAuth logs (5 files); manifest flow replaced by live listing (`/api/bundled-templates` + file route) + compose host-mount → publish templates by copying files (no rebuild/restart); Export emits zip+png+json sidecars; per-site sets (demo/prd/shared); Spanish guide + runbook updated |

---

### Intake queue

- 2026-07-16 · cross-cutting · "Prepare prod deploy from tar.gz backups + Demo mode with browser-only persistence" → completed (M4)
- 2026-07-16 · feedback · F4–F6, F9, F12 → **completed in code** (commit this session); browser smoke still owner/eng
- 2026-08-12 · feature · Import UX + templates (tasks 6–11 + .vcf import + role-gated global templates) → **IMPLEMENTED + COMMITTED/PUSHED 2026-08-12** (Passes 0–6, all gates green): `.work/plans/20260812-import-ux-templates-plan.md` §9 implementation record. Same-day follow-up: demo KV-paste mapping fix (unknown labels no longer dropped; modal auto-opens; fuzzy strong-token priority). Residuals: Express batch-import stub deletion approval; full Playwright run in CI (`workflow_dispatch`); live `validate-token`/`app_roles` check against real tools-dashboard; browser walk-throughs; **prd/demo redeploy to ship**

---

## Blocked on owner

| # | Item | Notes |
|---|------|-------|
| 1 | DNS/TLS ownership for prod hostname | Procedure documented; host still operator-owned |
| 2 | Clean public Demo deploy (both env flags) | Internet Demo cutover |
| 3 | Manual browser click-through (Demo export + import-persistence + new F9/F12 UX) | Live PNG/font/clip/units still eng/owner |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | ~~Commit framework path migration~~ **DONE** (owner commit `247357a`) | Residual: stale `nginx` compose-table row decision in `.cursorrules` §Docker still open (TLS is host-level nginx, not a compose service) |
| **0b** | ~~UI Design OS cycle S0–S4~~ **DONE 2026-08-14** (foundation + 16 primitives + 4 screen rebuilds; token system live; audits pass) | committed + pushed with this close; UI bookend closed |
| **1** | Redeploy prd + demo (ship import-ux + paste-mapping fixes + drop-and-go templates + UI S0–S4 rebuild) | `git pull --ff-only` → `./bin/refresh-prd.sh --app` + `./bin/refresh-prd.sh demo`; recreate applies the new globals volume mount (a plain restart would not); recheck prd parse jobs / Cassandra; browser hard-refresh once for the new bundle |
| **2** | Manual browser click-through | Demo: paste with unknown labels → mapping modal opens; "Correo Trabajo"-style labels auto-pair; upload `.xlsx` → export PNG name+font; import design persistence; profile; units; **hostile first click (large paste / malformed CSV / mobile viewport)** — session goal, UI side shipped, live verification pending |
| **3** | Production deploy cutover | DNS/TLS; Demo flags on clean host |
| **4** | Start M6 or residual M1/M2 | Fabric parse TODO; batch-import placeholders — `@code-implementation plan` |
| **5** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **6** | UI follow-ups | pre-existing lint debt in CanvasControls/PropertyPanel (≈40); designer data-hex exception docs; `RecordSearch.tsx`/`RecordCard.tsx` deletion approval; i18n deep-pass on designer internals; dark-chrome re-theme |

---

## Current iteration

*(none active — import-ux plan implemented + demo paste-mapping fixes committed/pushed 2026-08-12, all gates green; next = prd/demo redeploy per Recommended next #1)*

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
| M4-T2 | Demo mode detection + provider + `/demo` route + banner | done |
| M4-T3 | Browser store layer (localStorage + IndexedDB) | done |
| M4-T4 | Demo adapters: projects + templates + resources | done |
| M4-T5 | Demo adapters: fonts + batches/records (render mocked) | done |
| M4-T6 | Auth bypass + api-server DEMO_MODE write guard | done |
| M4-T7 | Tests + lint/tsc in compose + MOD-06 + CHANGELOG | done |
| M4-verify | Public-Demo barriers (apiClient + Next BFF) | done |
