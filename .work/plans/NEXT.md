# NEXT - planning backlog

**Updated:** 2026-08-28 (FC+GD+review-fix tree re-verified green after abrupt session end — committed + pushed; L-1 code comment added; demo.yml:292 override pending owner approval)

---

## Done

| Item | Artifact |
|------|----------|
| Geometry persistence fix (2026-08-27) — position+dimensions respected across save/reopen/export/worker regardless of workflow | `.work/plans/20260827-geometry-persistence-fix-plan.md`, iteration GD in this file; identity-keyed save (id > name > new), id-keyed blobs, gallery twin dedupe, canvas-authoritative geometry merge (folded dimensions all types), ActiveSelection + QR-ghost desync fixes, worker QR width/height parity; front 425 + api 213 + worker 54 tests green |
| Font fidelity + fit fix (2026-08-27) — design font/size always respected; width-only fit shrink; worker real fonts | `.work/plans/20260827-font-fidelity-fix-plan.md`, iteration FC in this file; `fontService.ts` FontFace-await preload, `exportService.ts` width-only shrink, worker `fontLoader.ts` + `computeFitScale`, Dockerfile fonts; front 420 + worker 53 tests green; live Montserrat PNG probe |
| Field-binding & line-compaction reliability fix (2026-08-27) + isEditing TypeError fix | `.work/plans/20260827-field-binding-compaction-fix-plan.md`, iteration FB in this file; `fieldResolution.ts`, `lineCompactionService.ts` rewrite, render-worker parity, export/render reports, property-panel UX; front 408 + worker 37 tests green |
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
| Paste button + records view fixes (2026-08-18) | Hover-focus paste machinery removed → explicit Paste/Pegar button (`clipboard.readText`, empty/denied hints, EN/ES); Ctrl+V kept page-wide; records DataTable name/phone cells no longer empty (render fns); "View all fields" details modal (all populated fields, grouped); CDP real-browser probes proved 28-field paste→LOADED→details journey live; front jest 373 |
| Unified alias table + French + render fixes (2026-08-18) | `field-aliases.json` single source (en/es/fr, 222 aliases) → both parsers build from it; French for all non-brand fields; TS KV-parity fix (colon-space pastes no longer hijacked by vertical parser); first-wins duplicate-column guard; suffix-tolerant duplicate fieldId resolution (both render paths); 30/30 render-map coverage machine-verified; mangled-label proof 28/28 both parsers; parity+variation tests both sides |

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
| **0** | ~~FIX render-worker tofu text~~ **DONE in code 2026-08-27** (iteration FC) | Baseline fonts in `Dockerfile.{dev,prd}` + live font registration via api-server catalog (`fontLoader.ts` + `registerFont`) + fit-to-width parity. Live-verified in dev (Montserrat render, `tmp/font-probe.png`); prd image build-verified. **Ships on the next prd/demo redeploy** (image rebuild required). |
| **0b** | ~~Commit framework path migration~~ **DONE** (owner commit `247357a`) | Residual: stale `nginx` compose-table row decision in `.cursorrules` §Docker still open (TLS is host-level nginx, not a compose service) |
| **0b** | ~~UI Design OS cycle S0–S4~~ **DONE 2026-08-14** (foundation + 16 primitives + 4 screen rebuilds; token system live; audits pass) | committed + pushed with this close; UI bookend closed |
| **1** | Redeploy prd + demo (ship import-ux + paste-mapping fixes + drop-and-go templates + UI S0–S4 rebuild + Paste button & records-view fixes + **FB field-binding + FC font/fit + GD geometry-persistence fixes**) | `git pull --ff-only` → `./bin/refresh-prd.sh --app` + `./bin/refresh-prd.sh demo`; **image rebuild is required for FC/GD** (fonts live in the worker image; api-server ships the id-keyed save; a plain restart would not pick them up); recreate applies the new globals volume mount; recheck prd parse jobs / Cassandra; browser hard-refresh once for the new bundle |
| **2** | Manual browser click-through | **Fresh tab first** (2026-08-18 hang was a wedged HMR tab): Paste button (allow clipboard permission once) with `tmp/testdata.txt` → 28 fields visible via "View all fields"; Demo: paste with unknown labels → mapping modal opens; upload `.xlsx` → export PNG name+font; import design persistence; profile; units; hostile first click (large paste / malformed CSV / mobile viewport) |
| **3** | Production deploy cutover | DNS/TLS; Demo flags on clean host |
| **4** | Start M6 or residual M1/M2 | Fabric parse TODO; batch-import placeholders — `@code-implementation plan` |
| **5** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **6** | UI follow-ups + review tech-debt | pre-existing lint debt in CanvasControls/PropertyPanel (≈40); designer data-hex exception docs; `RecordSearch.tsx`/`RecordCard.tsx` deletion approval; i18n deep-pass on designer internals; dark-chrome re-theme. Review 2026-08-27 lows: L-1 LOCAL_ONLY id churn, L-2 worker QR raster stretch, L-3 fit left-edge asymmetry, L-4 family case-folding, L-5 worker temp-font cleanup, L-7 name-only dedupe key |
| **7** | **Security decision: R16 (font-file endpoint authz)** | `GET /api/v1/fonts/:fontId/file` honors `?userId=` on optional auth → anonymous fetch of any user's private font (pre-existing HIGH; worker fontLoader relies on it for user-owned fonts). Decide: service token for worker vs role-gated query param. `.work/plans/RISK_REGISTRY.md` R16 |

---

## Current iteration

**Milestone ref:** GD — Geometry persistence fix (owner-approved plan: `.work/plans/20260827-geometry-persistence-fix-plan.md`, 2026-08-27; HANDOFF waiver: plan approved directly by owner — "MAKE SURE ALL TASKS ARE COMPLETED" + "POSITION AND DIMENSIONS OF OBJECTS MUST BE RESPECTED REGARDLESS OF THE WORKFLOW" — not derived from plan-master)
**Status:** complete (all tasks + gates green; committed + pushed 2026-08-28 after full re-verification) · **Started:** 2026-08-27 · **Completed:** 2026-08-27 · **Target:** all GD tasks + gates green

### In scope

- Identity-keyed save end-to-end (front sends `currentTemplate.id`; api-server prefers id-match, name-lookup legacy fallback; id-derived S3/fallback blob keys — legacy name-keyed rows stay readable via stored storageUrl)
- Twin prevention: `listTemplates` dedupe by (name, projectId) preferring server; local fallback saves marked `unsynced`
- Canvas-authoritative geometry at save: folded live dimensions per element type (QR size synced, images exact scale), loud mismatch logging, template width/height asserted
- Desync fixes: ActiveSelection `object:modified` writes folded dimensions; QR placeholder re-add guard
- render-worker `drawQr` width/height parity
- Tests (front/api/worker) + gates + docs

### Out of scope (explicit)

- Migrating/renaming existing name-keyed blobs (legacy rows readable via stored storageUrl)
- UI badge for `unsynced` records (service-level flag + log only)
- Save-guard (`processingModification`/`systemUpdating`) semantics — loop prevention untouched
- QR vCard double-generation + worker static-QR content (separate logged follow-ups)

### Tasks

| ID | Description | Files | Status | Notes |
|----|-------------|-------|--------|-------|
| GD-T1 | Identity-keyed save: `SaveTemplateRequest.id` → controller → `SaveTemplateInput.id`; server id-preferred upsert (ownership/project verified); id-derived blob keys; front adopts returned id | front templateService.ts(+test new), components/Canvas/CanvasControls.tsx; api unifiedTemplateStorageService.ts, templateController.ts, tests/.../unifiedTemplateStorageService.test.ts (new) | done | contract: `id` sent ⇔ in-place save (excluded open-template→save fork); server resolution: id-match > name-match (legacy) > new; S3/fallback keys id-derived |
| GD-T2 | Twin prevention: listTemplates dedupe (name+projectId, server wins); fallback local saves marked `unsynced` | front templateService.ts(+test) | done | collision key reduced to name-only (neither TemplateMetadata nor CachedTemplate carries projectId — documented at merge site) |
| GD-T3 | Canvas-authoritative geometry merge: folded dimensions per type + loud mismatch logging + width/height assert at save | front CanvasControls.tsx | done | new exported helpers `readEffectiveCanvasGeometry` (ActiveSelection group-relative transform composed via qrDecompose — probe-verified against post-deselect ground truth) + `foldCanvasGeometryForElement` (mirrors mouseup fold per type) |
| GD-T4 | Desync fixes: ActiveSelection modified writes folded dimensions; QR placeholder re-add without map dependency | front DesignCanvas.tsx | done | guards untouched — GD-T4.3 decision documented (guarded position writes unnecessary + loop-risky; save-time merge is the backstop) |
| GD-T5 | Worker drawQr `width ?? size` / `height ?? size` parity + test | render-worker fabricTemplateRenderer.ts, tests/fabricTemplateRenderer.test.ts | done | drawImage spy test: 120×60 with size:80 |
| GD-T6 | Gates (api/front/worker jest+tsc, front lint touched, touch-scope, blast-radius) + MOD-06 + docs + NEXT/HANDOFF | .work/*, BATCH-EXPORT-IMPLEMENTATION.md | done | |

### Acceptance criteria

1. In-place save updates the record the user edited — by id — never a same-named twin.
2. Two same-named records can never alias one blob or shadow each other in the gallery.
3. Saved JSON geometry (position AND dimensions) equals what the canvas shows, for every object type, after any edit sequence incl. canvas resize + delete + re-add.
4. Reopen, browser export, and worker render read the same geometry (worker QR honors width/height).
5. All gates green; touch-scope clean.

### Validation steps

- `docker compose -f docker-compose.dev.yml exec front-cards sh -c "cd /app && npm test && npx tsc --noEmit"` + eslint on touched files
- `docker compose -f docker-compose.dev.yml exec api-server sh -c "cd /app && npm test"` (+ tsc per repo convention)
- `docker compose -f docker-compose.dev.yml exec render-worker sh -c "cd /app && npm test"`
- `bash /mnt/work/Projects/pilo.ai.logicbison/scripts/touch-scope-verify.sh` + `blast-radius-check.sh`
- Regression: same-name in-place save updates the same id; resized+centered QR survives save→reload JSON round-trip with exact x/y/width/height/size

### Owner blockers

*(none)*

### Cross-LLM verification

- **Triggered:** no

### Done this iteration

| ID | Description | Status |
|----|-------------|--------|
| GD-T1 | Identity-keyed save end-to-end (front sends `id` on in-place saves; server id-match > name-match > new; id-keyed S3/fallback blobs; legacy name-keyed rows stay readable) + 6 api tests | done |
| GD-T2 | Gallery twin dedupe (server wins on name collision, warn logged) + `unsynced` marking on local fallback saves + 4 front tests | done |
| GD-T3 | Save-time geometry is now canvas-authoritative: position AND folded dimensions per element type; store↔canvas mismatches logged loudly (never block save) | done |
| GD-T4 | Multi-select transforms write full folded geometry per child (group-relative transform composed — probe-verified); QR placeholder map-miss mounts real QR instead of ghosting | done |
| GD-T5 | Worker QR honors `width ?? size` / `height ?? size` + test | done |
| GD-T6 | Gates + MOD-06 + carriers | done |

**Review-fix round (2026-08-27, from `.work/feedback/20260827-uncommitted-review-font-geometry.md`):** H-1 fixed — template resolution no longer uses the paged `listTemplates` (page 1/20 broke >20-template saves): id path = direct `getTemplateById` + ownership/project check; name path = project-scoped `take:1000` (no unpaged name finder exists; `client.ts` out of scope). M-1 fixed — `registeredKeys` marked only after successful `registerFont` (not-in-catalog still marked; transient failures retry next render). M-2 fixed — dead `updateTemplate` re-saves in place (`id` + `kind`/`global` preserved; delete-then-resave removed; zero callers, inert). M-3 fixed — worker bold mapping mirrors browser (`'bold'|700|'700'` via `isBoldFontWeight`, used by both collectFontRequirements and drawText). L-6 fixed — uniform overridable `INTERNAL_API_URL` in all three compose files. Tests: api +4 (217/220), worker +3 (57/57), incl. >20-template regression tests that fail against the old code. **S-1 (pre-existing HIGH, font-file endpoint `?userId=` implicit credential) logged as R16 — needs owner decision (service token vs role gate), NOT fixed in this iteration per review recommendation.** Tracked lows: L-1 LOCAL_ONLY id churn, L-2 worker QR raster stretch, L-3 fit left-edge asymmetry, L-4 family case-folding, L-5 worker temp-font cleanup, L-7 name-only dedupe key.

**Gates evidence (2026-08-27, dev compose, final tree carrying FC+GD+review fixes):** front jest 71/71 suites, 425/425 tests; front `tsc --noEmit` exit 0; eslint touched files 0 NEW errors (CanvasControls 24→24, DesignCanvas 75→75 pre-existing errors, templateService 4→4 + one warning fixed; templateService.test.ts clean); api jest 25/25 suites, 217 passed + 3 skipped; api tsc: 2 errors verified PRE-EXISTING (deleteTemplate StorageMode, untouched code — stash-proven); worker jest 8/8 suites, 57/57 tests; touch-scope pass (union scope FC+GD — one uncommitted tree, both owner-approved); compose config valid dev/prd/demo with uniform overridable INTERNAL_API_URL; blast-radius high/fail verdict expected (7 areas incl. protected compose/Dockerfiles — all explicitly owner-approved across FC+GD).

**MOD-06 AI change risk summary:** AI-assisted: yes · boundaries crossed: 3 deployables (front-cards, api-server, render-worker) — owner-approved scope · API contract: save endpoint gains OPTIONAL `id` field (backward-compatible; legacy name-upsert preserved when absent) · new cross-boundary deps: none · test isolation: ok (per-module suites; Prisma/S3 mocked in new api tests; fabric+jsdom probe for the ActiveSelection transform math) · blast radius: template save/load + render geometry; wrong behavior = misplaced/missized objects on saved cards, caught by new unit tests (id-preferred upsert, twin dedupe, folded-dimensions fold, QR parity); no DB schema changes; blob-key change is write-side only (reads use stored storageUrl — legacy rows safe) · recommendation: merge_ok.

### Concept / NFR registry (this iteration)

| Concept | Applies | Status | Reason |
|---------|---------|--------|--------|
| MOD-06 ai-amplification | yes | done | agent-authored code; risk summary in §Done this iteration (2026-08-27): 3 deployables (owner-approved), optional backward-compatible API field, no schema changes, blob-key change write-side only (legacy rows readable) → merge_ok |
| MOD-01 coupling-audit | no | N/A | same module boundaries; save API gains an optional field (backward-compatible) |
| MOD-02/03/04/05/07/08 | no | N/A | no new hops, billable units, deployables, extraction, LLM feature, or IaC |

---

### Completed — FC: Font fidelity + fit fix (complete 2026-08-27)

Owner-approved plan `.work/plans/20260827-font-fidelity-fix-plan.md`. FC-T1 FontFace-awaited preload (exact variant, no swap, demo path too); FC-T2 width-only fit shrink; FC-T3 worker fontLoader via api-server catalog + registerFont (+ INTERNAL_API_URL in dev/prd/demo compose); FC-T4 worker fit parity (`computeFitScale`); FC-T5 baseline fonts in both worker Dockerfiles (+ prd fontconfig cache fix). Gates: front 70 suites/420, worker 8 suites/53 (0 skips post-rebuild), tsc clean, touch-scope pass, MOD-06 merge_ok; live Montserrat PNG probe + prd image build-verified. Not yet committed at FC close.

---

### Completed — FB: Field-binding & line-compaction reliability fix (complete 2026-08-27)

Owner-approved plan `.work/plans/20260827-field-binding-compaction-fix-plan.md`. FB-T1 fieldResolution module; FB-T2 new line-emptiness semantics + `requiredFields` gate + `linePriority` removed; FB-T3 batch export field report; FB-T4 render-worker parity (blank-on-missing, compaction port); FB-T5 property-panel UX; FB-T6 types/docs; FB-T7 gates (front 70 suites/408, worker 7 suites/37, tsc clean, touch-scope pass, MOD-06 merge_ok). Follow-up: `isEditing` boolean fix (`DesignCanvas.tsx:1687`). Committed + pushed 2026-08-27.

---

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
