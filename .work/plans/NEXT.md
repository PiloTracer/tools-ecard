# NEXT - planning backlog

**Updated:** 2026-08-18 late (alias-table unification + French + render-resolution fixes committed/pushed; **render-worker tofu finding** — Dockerfile font fix pending owner approval)

---

## Done

| Item | Artifact |
|------|----------|
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
| **0** | **FIX render-worker tofu text (critical)** | Worker ships zero fonts + no `registerFont` → every server-rendered card is tofu (proved 2026-08-18 with all-field PNG render). Minimal: add `fontconfig` + `fonts-liberation`/`fonts-dejavu` to `render-worker/Dockerfile.{dev,prd}` (**protected files — needs owner approval**). Full fidelity: download template fonts from SeaweedFS + `registerFont` in worker (new feature; mirror browser fontService preload). Add a legibility assertion to worker tests after. |
| **0b** | ~~Commit framework path migration~~ **DONE** (owner commit `247357a`) | Residual: stale `nginx` compose-table row decision in `.cursorrules` §Docker still open (TLS is host-level nginx, not a compose service) |
| **0b** | ~~UI Design OS cycle S0–S4~~ **DONE 2026-08-14** (foundation + 16 primitives + 4 screen rebuilds; token system live; audits pass) | committed + pushed with this close; UI bookend closed |
| **1** | Redeploy prd + demo (ship import-ux + paste-mapping fixes + drop-and-go templates + UI S0–S4 rebuild + **Paste button & records-view fixes**) | `git pull --ff-only` → `./bin/refresh-prd.sh --app` + `./bin/refresh-prd.sh demo`; recreate applies the new globals volume mount (a plain restart would not); recheck prd parse jobs / Cassandra; browser hard-refresh once for the new bundle |
| **2** | Manual browser click-through | **Fresh tab first** (2026-08-18 hang was a wedged HMR tab): Paste button (allow clipboard permission once) with `tmp/testdata.txt` → 28 fields visible via "View all fields"; Demo: paste with unknown labels → mapping modal opens; upload `.xlsx` → export PNG name+font; import design persistence; profile; units; hostile first click (large paste / malformed CSV / mobile viewport) |
| **3** | Production deploy cutover | DNS/TLS; Demo flags on clean host |
| **4** | Start M6 or residual M1/M2 | Fabric parse TODO; batch-import placeholders — `@code-implementation plan` |
| **5** | Monitoring + automated backups | Prometheus/Grafana/Sentry; wire `bin/start_cron.sh` |
| **6** | UI follow-ups | pre-existing lint debt in CanvasControls/PropertyPanel (≈40); designer data-hex exception docs; `RecordSearch.tsx`/`RecordCard.tsx` deletion approval; i18n deep-pass on designer internals; dark-chrome re-theme |

---

## Current iteration

**Milestone ref:** FB — Field-binding & line-compaction reliability fix (owner-approved plan: `.work/plans/20260827-field-binding-compaction-fix-plan.md`, 2026-08-27; HANDOFF waiver: plan approved directly by owner, not derived from plan-master)
**Status:** complete (all tasks + gates green; not yet committed) · **Started:** 2026-08-27 · **Completed:** 2026-08-27 · **Target:** all FB tasks + gates green

### In scope

- New line-emptiness semantics (any data-bound element with content keeps the line; static-only lines always kept; `requiredFields` becomes the explicit override; `linePriority` removed entirely)
- Alias/case/suffix-tolerant render-time fieldId resolution, both render paths
- render-worker parity: blank-on-missing (no placeholder leakage), compaction port, line metadata in element JSON
- Batch export report (unresolvable fieldIds, record fields with no matching element, lines removed) — no silent drops
- Property panel: valid/auto line-group values with inline validation, canonical-field dropdown for fieldId with unresolvable-field warning, Line Priority control removed, misleading copy fixed
- Types deprecation notes + BATCH-EXPORT-IMPLEMENTATION.md binding-contract docs

### Out of scope (explicit)

- Field fallback chains (the operator's "priority as substitution order" idea) — future SPEC candidate
- `renderer.ts:84-92` PG fallback 5/28 fields — flagged residual, not changed
- Position-map same-type collision (`lineCompactionService.ts:61-67`) — unchanged unless hit by tests
- api-server type mirror, demo parser, ingest pipeline — untouched
- Single-design export path (no record data by design)

### Tasks

| ID | Description | Files | Status | Notes |
|----|-------------|-------|--------|-------|
| FB-T1 | fieldResolution module: normalize + alias-aware `resolveRecordProperty`, record-value getter, resolvability check; refactor batchExportService to use it | front-cards/.../services/fieldResolution.ts(+test), batchExportService.ts | done | aliases from features/demo/fixtures/field-aliases.snapshot.json (byte-identical to shared-types) |
| FB-T2 | New compaction semantics + `requiredFields` override (record param) + linePriority removed | front-cards/.../services/lineCompactionService.ts, lineCompactionService.test.ts (new), batchExportService.ts (pass record) | done | keep remove/move mechanics + renumbering |
| FB-T3 | Batch export report (aggregate; on result + logs) | front-cards/.../services/batchExportService.ts, batchExportFieldMapping.test.ts | done | |
| FB-T4 | render-worker parity: blank-on-missing, alias-aware key resolution, compaction port, metadata in TemplateElementJson | render-worker/src/services/fabricTemplateRenderer.ts, lineCompaction.ts (new), fixtures/field-aliases.snapshot.json (new copy), tests/ | done | snapshot copy per duplication convention |
| FB-T5 | Property panel UX: lineGroup valid suggestions + inline validation, remove Line Priority, fieldId dropdown + warning, copy fixes | front-cards/.../PropertyPanel/LineMetadataProperties.tsx, TextProperties.tsx | done | |
| FB-T6 | Types deprecation notes + docs (binding contract, valid lineGroup format, semantics) | front-cards/.../types/index.ts, BATCH-EXPORT-IMPLEMENTATION.md | done | |
| FB-T7 | Gates: front jest+lint+tsc, worker jest+tsc (compose); MOD-06; NEXT/HANDOFF | .work/plans/NEXT.md, .work/context/HANDOFF.md | done | |

### Acceptance criteria

1. A text element whose record field has data is never removed/blanked by compaction (both render paths).
2. A line whose data-bound elements are all empty is hidden and the next line moves into its exact original coordinates.
3. Static-only lines are never removed; icons never keep a dataless line alive.
4. `requiredFields` on any line element gates line visibility against the record.
5. UI no longer suggests invalid lineGroup formats; invalid input is rejected inline; no Line Priority control.
6. Batch export result carries a report of unresolvable fieldIds / unmatched record fields / removed lines.
7. Browser export and render-worker produce the same visible fields for the same template + record.

### Validation steps

- `docker compose -f docker-compose.dev.yml exec front-cards bash -c "cd /app && npm test"` (jest full)
- `docker compose -f docker-compose.dev.yml exec front-cards bash -c "cd /app && npm run lint && npx tsc --noEmit"`
- `docker compose -f docker-compose.dev.yml exec render-worker bash -c "cd /app && npm test && npx tsc --noEmit"`
- Regression test reproducing operator scenario (priority-less mobile_phone line with data ⇒ renders; empty ⇒ collapses)

### Owner blockers

*(none)*

### Cross-LLM verification

- **Triggered:** no

### Done this iteration

| ID | Description | Status |
|----|-------------|--------|
| FB-T1 | fieldResolution module + batchExportService refactor (alias/case/suffix-tolerant render-time resolution) | done |
| FB-T2 | New line-emptiness semantics (any-bound-content, static-line exemption, requiredFields override, linePriority removed) + 13 tests | done |
| FB-T3 | Batch export field report (unresolvable fieldIds / unmatched record fields / removed lines) + test | done |
| FB-T4 | render-worker parity (blank-on-missing, alias-aware resolution, compaction port, render report) + tests | done |
| FB-T5 | Property panel: valid lineGroup suggestions + inline validation, Line Priority removed, Data Field control with suggestions + unknown-field warning | done |
| FB-T6 | Types deprecation notes + docs (BATCH-EXPORT-IMPLEMENTATION.md binding contract; template-batch.md note) | done |
| FB-T7 | Gates: front jest 70 suites/408 passed, tsc clean, lint 0 errors on touched files (199 pre-existing errors elsewhere); worker jest 7 suites/37 passed; touch-scope pass; blast-radius warn (3 areas, owner-approved scope); MOD-06 done | done |

**Gates evidence (2026-08-27, dev compose):** `front-cards npm test` 70/70 suites, 408/408 tests; `npx tsc --noEmit` exit 0; eslint on touched files 0 errors (repo-wide lint debt pre-existing, see Recommended next #6). `render-worker npm test` 7/7 suites, 37/37 tests; worker `tsc --noEmit` has 1 pre-existing unrelated error (`cassandra-driver` types missing in container node_modules; untouched file `src/core/database/cassandra.ts`).

**MOD-06 AI change risk summary:** AI-assisted: yes · boundaries crossed: 2 deployables (front-cards browser export + render-worker server render) — owner-approved scope · new cross-boundary deps: none (byte-identical fixture copy per repo convention) · test isolation: ok (per-module jest suites cited above) · blast radius: batch card/QR render output only; wrong behavior = blank/misplaced fields on generated cards, caught by the new regression tests incl. the operator's exact scenario; no DB schema or API contract changes · recommendation: merge_ok.

### Concept / NFR registry (this iteration)

| Concept | Applies | Status | Reason |
|---------|---------|--------|--------|
| MOD-06 ai-amplification | yes | done | agent-authored code; risk summary recorded in §Done this iteration (2026-08-27): boundaries=2 deployables (front-cards + render-worker, owner-approved), no new cross-boundary deps, test isolation ok, blast radius = batch card/QR render output, no schema/API changes → merge_ok |
| MOD-01 coupling-audit | no | N/A | changes stay inside template-textile feature + render-worker renderer; no new module boundaries |
| MOD-02/03/04/05/07/08 | no | N/A | no new hops, billable units, deployables, extraction, LLM feature, or IaC |

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
