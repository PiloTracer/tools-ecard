# HANDOFF - session boundary

## Session status

**No open session.** Next session starts with `@session-control start`.

**Closed:** 2026-08-12 (PM) — goal: implement import-ux + templates plan (owner-approved). Done: **all 7 passes implemented and gate-verified** — P0 baseline hardening (env-leak test, `is_public` migration after non-destructive prisma baseline, unmapped-column preservation, canonical 30-field list + 3-way parity tests) · P1 downloadable horizontal/vertical template XLSX + transposed-XLSX parsing both parsers · P2 full `.vcf` vCard import (2.1 QP/3.0/4.0, multi-card) both parsers with fixture parity · P3 field-mapping (`/api/batch-import/preview` + explicit `--mapping` + `FieldMappingPreset` CRUD + `FieldMappingModal` upload+paste, Demo parity) · P4 `TemplateMetadata.kind` + fork-on-save semantics + gallery filters · P5 role-gated global templates (`app_roles` claim + `requireAppRole` via authoritative `validate-token`, `appsuper`|`appglobal`, deny-by-default; API channel via `isPublic` + bundled channel `front-cards/public/templates/globals/` + manifest script) · P6 Playwright smoke specs + runbook/README + RISK_REGISTRY (R2 closed, R11–R15) + plan §9 implementation record. Final gates (reproduced twice, no flake): python 64 OK+1 expected skip · api 207 pass/0 fail/3 skip · front 307 pass/45 suites · front tsc clean · prisma 5 migrations clean · eslint zero new issues. Walkthrough docs for the later cross-LLM verification: `.work/plans/20260812-import-ux-templates-list.md` (full change inventory + test matrix) and `-highlights.md` (owner-facing features). Committed + pushed (app code in a separate feat commit).

**Residual / owner actions:** full Playwright run only possible in CI (dev container is Alpine/musl — specs compile 6/6); live check that tools-dashboard issues `app_roles` for the ecards `client_id` in dev+prd and the `validate-token` contract (mock-tested only); browser click-throughs (mapping modal, global save/fork); deletion of dead Express `batch-import/routes.ts`+`controllers/` still pending owner approval; stale `nginx` compose-row decision open; `.qwen/` gitignore decision open; untracked `reasonix.toml` untouched.

**Prior closed:** 2026-08-12 — import-ux + templates planning (plan v3 written, review-verified, committed `d07531e`). Details below in audit history.

Treat prior closed sessions as historical only; see "What this cycle produced" below.

**Closed:** 2026-08-11 — goal: verify `.cursorrules` consistency & reliability after the framework path migration. Read-only audit: all 4 source pointers (`/mnt/work/Projects/.ai*`) resolve; all 16 Agent OS + 6 SOC skill handles exist; every local `.work/`, `.work.soc/`, `.work.ui/` reference resolves; `soc-deploy-basic.sh verify` → all checks passed; `deploy-basic.sh status` → cursorrules-verify PASS; zero stale `/data/Projects` refs. Findings (not fixed, pending decision): stale `nginx` row in §Docker compose table (TLS is host-level nginx, explicitly not part of the stack); SOC unreachable-source fallback contradicts the Agent OS/UI stop-policy (SOC block is generator-owned — fix upstream). No code changes this session.

**Closed:** 2026-08-01 (PM) — goal: make batch import + login work across dev / prd / demo. Done: (1) dev Normal-mode upload fixed end-to-end — dev `.env` flipped to `USE_LOCAL_STORAGE=true` (host SeaweedFS down with the tools-dashboard stack), `batchService` now sends `credentials: 'include'` on all reads (httpOnly cookie made the Bearer fallback empty → silent 401 → "nothing happens" on file select), name modal no longer blocks on list failure, Python-stderr log noise downgraded to warn; all 6 operator samples verified through the full pipeline (storage→queue→worker→parser→Postgres+Cassandra), 7/7 LOADED (`6d34bf4`). (2) Login: `subscription` scope dropped everywhere (provider registrations only allow `profile email`; requesting more rejected every login) — code defaults + `.env`/`.env.prd`/`.env.demo`; OAuth failures now redirect to the Tools Dashboard app library instead of an e-cards error screen; "Go to Tools Dashboard" link added on the login page (`65af773`). Verified: jest 191, api jest 46, python 28, tsc both apps, live `scope=profile email` from `/api/auth/login`. Committed + pushed.

**Residual / owner actions:** prd host still runs pre-fix code AND its parse jobs die before PARSING (batches stuck UPLOADED + "0 records" in batch view — points at Cassandra/keyspace reachability from the worker, not parse logic). On the prd host: edit `.env.prd` (`OAUTH_SCOPES=profile email`), `git pull --ff-only`, `./bin/refresh-prd.sh --app`, then retry the failed batches; diagnose Cassandra if still stuck. Demo stack: `./bin/refresh-prd.sh demo ui`. Dev login 502 = local `tools-dashboard` stack down (sibling project). Dev DB holds synthetic `e2e_*` test batches (cleanup offered, not approved). Manual browser click-through still pending. Prd host unreachable from this machine (no ssh) — agent offered to run the deploy if given access.

**Closed:** 2026-08-01 — goal: verify uncommitted batch-import fixes against 6 operator samples (`.work/feedback/test-data.md`) for `.txt`/`.md` upload and clipboard paste, both Demo and Normal modes. All 6 samples parse correctly in both parsers (names, titles, emails, phones/exts); `.md` now accepted end-to-end; permanent fixture-based regression tests added (`operator_batch_samples.json` in `api-server/batch-parsing/fixtures/` + `front-cards/features/demo/fixtures/`). Verified: python unittest 28/28, front-cards jest 191, api-server batch-upload jest 46 passed; eslint clean (1 pre-existing warning). Committed + pushed.

**Prior:** Open 2026-07-28 — goal unset; HANDOFF not formally closed. `main` advanced since (demo OAuth scoping, batch record limits, XML entity decode — see recent commits).

**Prior:** Open 2026-07-24 — production cutover (host nginx, TLS/Cloudflare, render-worker health, `bin/start.sh` dev+prd); landed on `main` (see recent commits). Closed without explicit `@session-control close` in HANDOFF.

**Prior:** Closed 2026-07-16 — Operator feedback F4–F6/F9/F12 (profile, ingest-only capitalize, image clip shapes, canvas units) + api-server jest OOM runner; verified, committed, pushed

**Updated:** 2026-08-12

**Note (2026-07-24):** Nine commits landed on `main` on 2026-07-24 (prd env-file policy, health-gated startup, Prisma auto-recover, Redis auth at runtime, image force-recreate, redisConnection import path) that are **not** recorded in §What this cycle produced below — HANDOFF is stale for that work.

**Repository state:** `main` synced with `origin/main` post-close. Framework-migration leftovers resolved by owner commit `247357a` (`.cursorrules` + `.work.soc/plans/NEXT_SOC.md` + `.qwen/settings.json`). Untracked at root: `reasonix.toml` (outside session scope, untouched). Chat export lives in `tmp/` (gitignored). **Residual:** import-ux plan v3 approval → Pass 0; Express batch-import routes deletion approval; stale `nginx` row decision; `.qwen/` gitignore decision; manual browser click-through; owner DNS/TLS/Demo deploy; prd redeploy + Cassandra check; M1/M2 placeholders; monitoring.

**Recommended pick-up file:** `.work/plans/NEXT.md`

**Lost or new?** Read `.ai/START_HERE.md` (via `$AGENT_OS_SOURCE=/mnt/work/Projects/.ai`).

### UI layer (see `.work.ui/`)

- UI foundation: not started (`ui-foundation-complete: no`)
- NEXT_UI: `.work.ui/plans/NEXT_UI.md`
- Tokens: `front-cards/app/globals.css`

### SOC layer (see `.work.soc/`)

- Scaffold present; use `@session-soc` for security work.

---

## Fresh start - what the next session should do first

1. Run **`@session-control start`**.
2. Read **`.cursorrules`** (thin-client pointers + compose service names).
3. Read **P0 initial scope:** `.work/plans/foundation/*-01-*-initial-scope.md`.
4. Read **this file** through §Fresh start, then §Open owner actions.
5. Read `.work/plans/NEXT.md`.
6. For public Demo: confirm `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true` on a clean host (see operations runbook).

End with **`@session-control close`** (add `commit` / `commit push` only when requested).

### Conditional reads

| If the task touches… | Read first |
|----------------------|------------|
| Product scope / foundation | `.work/plans/foundation/*-01-*.md` … `*-04-*.md` |
| Any code or new feature | `.work/standards/CONVENTIONS.md`, `.ai/standards/*FEATURE_STANDARD*` |
| Demo / zero server writes | `.work/features/demo-local-persistence/20260716-SPEC.md` + amendment 01 |
| External integration | foundation `*-02-*.md`, `.work/docs/integration/MANIFEST.txt` (if any) |
| Security / threat model | `.work/standards/threat-model.md` |
| Stack / topology | `DOCS_TECH_STACK.md`, `.work/standards/DIRECTORY_MAP.md` |
| Master plan / milestones | `.work/plans/full/*-full-plan.md` |
| High-risk feature | Relevant `.work/features/<slug>/*-SPEC.md` |
| UI | `.work.ui/context/HANDOFF_UI.md`, `DOCS_UI_STACK.md` |

---

## Open owner actions

| # | Action | Blocks | Owner |
|---|--------|--------|-------|
| 1 | Clean public Demo deploy with both Demo env flags | Internet Demo cutover | owner |
| 2 | DNS/TLS ownership for prod hostname | Public cutover | owner |
| 3 | Document `/api/diagnostics` (U6) | Docs | **Resolved** — ops runbook |
| 4 | Manual browser click-through of Demo fixes (upload real `.xlsx`, run batch export, visually confirm name + font on output PNG) | Confidence in Demo fix | eng/owner |
| 5 | Pre-existing `traceability-verify.sh` gap: FR1-FR4, FR7-FR10 not mapped to `M{N}-T{N}` tasks in master plan (unrelated to this session's work; found while running the close pre-check) | Plan hygiene | eng |
| 6 | Manual browser click-through of import-persistence fix (import a `.zip`/`.json` design in Demo + Normal, close tab without Save, reopen, confirm it's listed in Open Template and loads correctly) — could not be unit-tested because `demoStore`/`browserStorageService` need `indexedDB`, unavailable in this repo's jsdom jest setup with no polyfill installed | Confidence in import-persistence fix | eng/owner |
| 7 | ~~Commit `.cursorrules` framework path migration + NEXT_SOC fix~~ — **Done** in owner commit `247357a`. Residual: decide the stale `nginx` compose-table row (TLS is host-level, not a compose service) | `.cursorrules` reliability | eng/owner |
| 8 | Approve import-ux plan v3 (`.work/plans/20260812-import-ux-templates-plan.md`) → start Pass 0; approve deletion of dead Express `batch-import/routes.ts`+`controllers/`; decide `.qwen/` gitignore; decide untracked `reasonix.toml` | Import-ux implementation | owner |

---

## Cross-framework action (@x-director)

**Date:** 2026-07-16  
**Request:** "Capitalization fixes can only be applied on data consumption… once inserted in the DB… stay like that… non-name texts should not be capitalized… maintain exception if found."  
**Frameworks involved:** .ai  
**Classified framework bucket(s):** engineering  
**Routing confidence:** high  
**Preflight (frameworks installed):** .ai yes | .ai.ui yes | .ai.biz yes | .ai.soc yes  
**Executed:**
1. Removed capitalize from `batchExportService.applyRecordData` and `fabricTemplateRenderer.resolveText` (export/render must not rewrite casing)
2. Applied person-name title case at Demo ingest in `mapRowToContactFields` via `nameCapitalize` (moved under `features/demo/`)
3. Confirmed Normal already title-cases at `DataNormalizer.format_field` during parse; `business_name` preserved; emails lowercased; record `updateRecord` paths do not re-format
4. Tests: demo parser + nameCapitalize + golden parity + render-worker green  

**User correction:** none  

**Coordination notes:** Product rule — capitalize once at first load/paste/import into storage; never on card print paths; preserve post-edit casing.  

**Blockers:** none  

**Next recommended:** `@session-control close commit` when ready to persist dirty tree  

---

## What this cycle produced (audit history - skim last session only)

| Date | Session | Artifacts |
|------|---------|-----------|
| 2026-04-27 | Claude → Agent OS migration | `.work/` populated; `.cursorrules` configured |
| 2026-04-27 | @plan-repair / @plan-master | Foundation + Approved master plan M1–M3; registries |
| 2026-04-27 | @code-implementation (M1-M3) | Render/storage/import/hardening artifacts (see RISK for residual gaps) |
| 2026-06-11 | Backup/Restore fix | `bin/start.sh` restore + volume fixes |
| 2026-06-12 | Production readiness + option 4 cleanup | creds/configs; `bin/start.sh` teardown |
| 2026-07-16 | Thin-client context verify + close | Removed `.ai/` + `.ai.ui` submodule; `.work/standards/`; lean `.cursorrules`; carriers |
| 2026-07-16 | M4 Demo + prd restore + verify | ADR 007; SPEC + amendment 01; Demo adapters; triple write barriers; runbook; `bin/verify-prd-env.sh` |
| 2026-07-16 | x-director final verify + close | Demo batch export/package fixes; BFF proxy test; jest `maxWorkers:1`; prd readiness gate |
| 2026-07-16 | session-control start → clone diagnosis → close | Confirmed `node_modules` / `.opencode` not in git; GitHub ~3MB; local tree ~11GB ignored deps; no code changes |
| 2026-07-16 | x-director Demo card-generation reliability fix | `exportService.ts` font preload (`preloadTemplateFonts`, both modes); `demoSpreadsheetParser.ts` XLSX self-closing-cell regex fix + per-field name fallback; `batchRecordService.ts` legacy-cols/updateRecord fixes; 3 new/updated test files (10 new tests); verified against user's real `.xlsx` file inside the running container |
| 2026-07-16 | x-director flexible field-mapping + import persistence | Fuzzy header fallback + phone/ext value reconciliation (`demoSpreadsheetParser.ts`, `data_normalizer.py`/`parser.py`); CSV/paste header-row + delimiter detection (`file_parser.py`); `CanvasControls.tsx` import now auto-persists (`templateService.saveTemplate`); new `test_batch_parsing.py` (17 tests); 16 new demo-parser tests; verified via container jest/python unittest + `git stash`-diffed eslint/tsc (zero new issues) |
| 2026-07-16 | x-director paste/import/font/naming session | KV+multi-section paste parsing + work-phone-prefix (Demo+Normal); font reopen fix (`fontService.preloadFontsForElements`, Regular/regular variant match); import name from filename with `(1)` dedup + Save modal; demo template upsert on re-save; jest 127 + python 22 green |
| 2026-07-17 | x-director M5 gap closure | Playwright smoke + CI; render-worker PNG (text/shapes/images/QR); parser golden fixtures; ops runbook; TS fixes; fake-indexeddb persistence test; render-status storageUrl; verification green (jest 137, render-worker 13, python 23, tsc 0) |
| 2026-07-16 | Operator feedback intake + x-director fixes | `.work/feedback/` from ODT; F8 focus fix; F1/F3 export+render-retry; F2/F7 nav+defaults; F10/F11 UI; jest 138 green; `close commit push` |
| 2026-07-16 | Feedback F4–F6/F9/F12 + ingest-only capitalize | Profile page; clipShape live+export+worker; canvas units; capitalize at Demo ingest only; api `run-tests.cjs`; MOD-06; jest 147 |
| 2026-08-01 | Operator batch-sample verify + close | 6 samples (`.work/feedback/test-data.md`) verified via `.txt`/`.md` upload + paste, Demo + Normal; fixture regression tests; python 28, jest 191 + 46 green |
| 2026-08-01 PM | Normal-mode upload + login fixes | Dev storage flip (local), batchService credentials + modal silent-failure fix, python stderr log level; prd parse-failure diagnosis (needs redeploy + Cassandra check); OAuth scopes `profile email` + failure→Dashboard redirect + login-page Dashboard link; full-pipeline e2e 7/7 LOADED |
| 2026-08-11 | `.cursorrules` verify + close | Read-only consistency/reliability audit of the path migration: source pointers, skill handles, local refs, built-in verifier audits — all green; stale `nginx` row + SOC fallback inconsistency flagged (unfixed); HANDOFF/NEXT refreshed |
| 2026-08-12 | Import-ux plan v3 + review fixes + close | Recovered interrupted session (verifications 1–5 done, no plan/code); wrote `.work/plans/20260812-import-ux-templates-plan.md` Passes 0–6; owner resolved D1–D4; independent review (`.work/feedback/20260811-uncommitted-review-import-ux.md`) claim-verified — all critical findings true, fixes applied (isPublic migration precondition, Fastify-only endpoint strategy, Pass 0 path, Bull wording, 3 env examples, parity casing); chat export → `tmp/`; no app code changed |
| 2026-08-12 PM | Import-ux plan implemented (Passes 0–6) + close | All 7 passes gate-verified: baseline hardening, template XLSX + transposed parsing, `.vcf` import, field-mapping + presets, template kinds, role-gated global templates (API + bundled), e2e/docs. Final: python 64, api 207/0/3, front 307/45 suites, tsc clean, prisma 5 migrations clean — reproduced twice, no flake. Walkthrough docs `-list.md` + `-highlights.md` for cross-LLM verification |

---

## Explicit unknowns (promoted from UNKNOWNS)

| ID | Summary | Blocks | Status |
|----|---------|--------|--------|
| U1 | Stack pins in DOCS_TECH_STACK | docs polish | Resolved 2026-07-16 |
| U2 | CI platform | M3-T1 | Resolved 2026-07-16 |
| U3 | Active dev vs maintenance | Priority | Resolved 2026-07-16 — active-dev for M4 |
| U4 | Production deployment target | Ops | Resolved 2026-07-16 — prd procedure documented; DNS/TLS operator-owned |
| U5 | Test coverage targets | M3-T2 | Resolved 2026-07-16 |
| U6 | `/api/diagnostics` undocumented | Docs | **Resolved** 2026-07-16 |

---

## Cross-framework action (@x-director)

**Date:** 2026-07-16  
**Request:** "subi un archivo de excel para proceder a la creacion de un batch y esto fue lo que visualice en los datos: puedes revisar y corregir el error"  
**Frameworks involved:** .ai  
**Classified framework bucket(s):** engineering  
**Routing confidence:** high  
**Preflight (frameworks installed):** .ai yes | .ai.ui yes | .ai.biz yes | .ai.soc yes  

**Executed:**
1. Root cause (1): Demo `file.text()` on `.xlsx` → mojibake — fixed with JSZip XLSX parser  
2. Root cause (2): title/section rows treated as contacts (no header-row detection) — added `findHeaderRowIndex` / `matrixToTable` + `isUsefulDemoContactRow` filter  
3. Unit tests for preamble skip + Spanish headers  

**Coordination notes:** Confirm gate skipped — concrete bug + screenshot evidence.  

**Blockers:** none  

**Next recommended:** delete old demo batch + re-upload Excel; confirm only real contacts appear  

---

## Cross-framework action (@x-director) — 2026-07-16 Demo card generation reliability

**Date:** 2026-07-16
**Request:** "today I added the functionality to run the app as demo... verify all the files that are currently uncommitted. The card generation is still not working properly, the image generated was lacking the persons' name, and the proper font part of the design has been lost. The app was working fine in normal mode, but on Demo it seems to have lost its way... perform full verification, and make sure the app is back to being FULLY OPERATIONAL AND RELIABLE regardless of being in Demo mode or NOT."
**Frameworks involved:** .ai
**Classified bucket(s):** engineering
**Routing confidence:** high
**Preflight (frameworks installed):** .ai yes | .ai.ui yes | .ai.biz no (not needed) | .ai.soc no (not needed)

**Executed (root-caused via explore subagent + empirical jest repros, all confirmed against the running dev stack):**
1. **Font lost (both modes; root cause, not Demo-specific):** `exportService.ts` never preloaded fonts before rendering — only `templateStore.loadTemplate` (editor-open path) did. Any offscreen export (single or batch) triggered without the editor pre-warming the exact font fell back to a system font. Fix: new `preloadTemplateFonts()` in `exportService.ts`, called before every export, that resolves each text element's font via `fontService`, then waits on the real Font Loading API (`document.fonts.load` + `.ready`) so Fabric never renders before the font is actually parsed. Fixes both Normal and Demo.
2. **Name missing (Demo upload, new bug in today's uncommitted parser):** `demoSpreadsheetParser.ts` `mapRowToContactFields` used an all-or-nothing positional-fallback gate — if ANY header (e.g. "Email"/"Puesto") matched a known alias, positional fallback was disabled for the WHOLE row, including columns whose header wasn't recognized (e.g. "Nombre y Apellido"). Rows kept their email but lost the name entirely. Fixed to apply the fallback per-field.
3. **Name/fields wrong or missing after Demo record edit / on new-style uploaded rows without separate first/last columns:** `batchRecordService.ts` `mapDemoRecord` fell back to legacy fixed `cols[1]/cols[2]/cols[3]` positions even for new-style rows that already have structured `fields` — stuffing an arbitrary spreadsheet column (e.g. email) into `firstName`. Fixed: legacy positional fallback now only applies to rows with no `fields` object at all (true legacy rows). Also fixed `updateRecord` (Demo) which collapsed `data` down to `{ cols: [fullName, firstName, lastName, email] }` on every edit, silently dropping business/address/social fields and the original `headers`/`cols` — now merges into existing `data.fields` instead.
4. Verified the already-uncommitted `resourceManager.ts` duplicate-import cleanup is a real fix (confirmed via `tsc`: removes 4 pre-existing `TS2300` duplicate-identifier compile errors).
5. Added regression tests: `demoSpreadsheetParser.test.ts` (+2), `batchRecordService.test.ts` (new, 3 tests), `exportService.test.ts` (new, 5 tests for `preloadTemplateFonts`).

**Verification (inside `front-cards` dev container):**
- `npx jest` (full suite): **13 suites / 103 tests passed**, 0 failed.
- `npx eslint` on all touched/new files: 0 new errors (pre-existing `no-explicit-any` errors elsewhere unchanged; a few pre-existing-style unused-var warnings on destructured omits).
- `npx tsc --noEmit` (container has a 512MB memory cap; required `NODE_OPTIONS=--max-old-space-size=460` via a one-off `docker compose run` to avoid OOM — pre-existing environment constraint, not caused by this change): diffed against `git stash` baseline — **identical pre-existing error set** (DesignCanvas.tsx, PropertyPanel.tsx, ElementsLayerManagerModal.tsx, batchExportService.ts, recordSearcher.test.ts, demoSpreadsheetParser.test.ts blob-type warnings), zero new errors introduced; resourceManager.ts's 4 duplicate-identifier errors are now gone (fixed).

**Coordination notes:** Confirm gate rendered and accepted before starting (single-framework, high confidence). No other framework needed.

**Blockers:** none

**Residual / unverified (not covered by this pass):**
- No manual/browser end-to-end repro was performed (no server-side reproduction harness for a live upload → export click-path in this session); all fixes verified via targeted jest unit tests that reproduce the exact data shapes empirically, plus full-suite regression run.
- Font fix depends on the referenced font actually existing in the font catalog (global fonts in Normal, uploaded-in-Demo fonts in Demo) — if a template references a font never uploaded to the current Demo session, it still falls back to a system font (now with a console warning instead of silent failure); this is a data-availability gap, not a code bug.
- Any **stale Demo batch data already sitting in a user's browser localStorage** from before today's parser fix (old `{ raw, cols }` shape, no `fields`) will still resolve via the legacy positional path — correct by design, but the user should re-upload affected batches for full field coverage (business/address/social fields not present in the legacy 4-column layout).

**Next recommended:** @ai-director - "manually re-verify in the browser: enter Demo mode, upload a real-world Excel/CSV with mixed-language headers, run a batch export, confirm both name and font render correctly on the output PNGs" (this session made static/unit-level verification only; a live click-through was not performed).

---

## Follow-up (@x-director) — 2026-07-16 same-day, real file still failing → found the actual root cause

**Request:** User supplied the real file (`tmp/staff_real.xlsx`) and a screenshot showing the name still missing after the fixes above (font looked fine). Asked to verify against the real file and confirm no other input format (CSV/semicolon/tab/.xls/.vcf) is broken.

**Root cause (the real one — items 2/3 above were real bugs but NOT the one hit by this file):** `demoSpreadsheetParser.ts`'s XLSX cell regex —
`/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g` — tried the **open/close alternative first**. At a self-closing cell (`<c r="D4" s="2"/>`, extremely common for empty/styled-only columns in real LibreOffice/Excel exports), the open-tag branch matched the trailing `/` as part of the attributes, then its lazy `([\s\S]*?)<\/c>` scanned **forward through the rest of the document** for the next `</c>` — silently swallowing every subsequent self-closing cell **plus the next real cell's contents** (here: the "Nombre" header two rows down) as if they were "inside" the empty cell, and skipping them entirely. `staff_real.xlsx` has exactly this shape (3 self-closing spacer cells on row 4, immediately before the header row) — confirmed by copying the real file into the `front-cards` container and running the parser against it directly (`HEADERS` came back with `Nombre` silently missing before the fix, present after).

**Fix:** reordered the regex to try the self-closing alternative first: `/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g`, in `demoSpreadsheetParser.ts`.

**Verified against the real file:** copied `tmp/staff_real.xlsx` into the `front-cards` dev container and ran the actual parser end-to-end — headers now include `Nombre` at the correct column, and `mapRowToContactFields` now produces `fullName: "Sofía Rodríguez Oviedo"` (previously silently dropped). Added a permanent synthetic regression test (`demoSpreadsheetParser.test.ts`) reproducing the same self-closing-cell XML shape so this can never silently regress — real binary fixtures are not committed (`tmp/` is gitignored by repo convention).

**Other input formats confirmed unaffected/still correct (existing + new tests, all passing):**
- CSV comma-delimited, semicolon-delimited (locale exports), tab-delimited — unaffected (no XML regex involved).
- Legacy `.xls` and `.vcf` — correctly rejected with a clear Demo-mode error (by design; Demo doesn't parse these, same as before).
- Title/preamble-row skipping and the two field-mapping fixes from the prior entry — still verified working together with this fix (full suite green).
- Confirmed Normal (non-Demo) mode is architecturally unaffected by any of this: server-side batch parsing (`api-server/batch-parsing/file_parser.py`) uses `pandas.read_excel(engine='openpyxl'/'xlrd')` — a mature library, completely unrelated code path to the Demo-only hand-rolled regex parser. This explains why the user's report ("works fine in Normal mode") was accurate and expected.

**Verification:** full `npx jest` → **13 suites / 104 tests passed**. `npx eslint` on the changed file → 0 errors.

**Blockers:** none

**Still not done (explicitly deferred, needs owner/human):** a live browser click-through (enter Demo mode → upload a real .xlsx → run batch export → visually confirm the PNG) has still not been performed by an agent in this session; all verification is at the parser/unit level against the actual real file's bytes. Recommend the user (or a session with browser tooling) do one manual pass before considering this fully closed.

---

## Cross-framework action (@x-director) — 2026-07-16 flexible field-mapping + import persistence

**Date:** 2026-07-16
**Request:** "1- make sure the system is flexible and able to locate data in the different scenarios considered, including excel, text, and copy-paste. Sometimes the labels do not match, sometimes even the phone might be an extension, and an extension might be a phone... this should be already built into the application, same with other fields. 2- make sure that when the user imports a design, it remains available across multiple sessions unless the user removes it or else."
**Frameworks involved:** .ai
**Classified bucket(s):** engineering
**Routing confidence:** high

**Explored first (two parallel read-only subagents) — findings:**
- Demo (`demoSpreadsheetParser.ts`) and Normal (`api-server/batch-parsing/data_normalizer.py` `FIELD_MAPPING`) each maintain their own **exact-match-only** header-alias dictionary; neither had any fuzzy/partial fallback for the actual field assignment (only header-ROW detection scoring used partial matching, not column-to-field mapping). Value-based phone↔extension reclassification existed only in the Python vertical-`.txt` parser, nowhere else.
- Import of a design (`CanvasControls.tsx` `handleImportJSON`) only updated the in-memory Zustand store and called `markAsSaved()` — it never called `templateService.saveTemplate`. Closing the tab (or navigating away) right after Import silently discarded the design in both Demo and Normal mode; only a separate, manual Save persisted it.

**Executed:**
1. **Fuzzy header fallback** (label mismatches like "Teléfono Oficina 2", "Cel./WhatsApp", "Numero de Extension"): added token-based partial matching, tried only for headers that don't exactly match a known alias, never overwriting a field a real alias already claimed, and returning "no match" (not a guess) when tokens point at more than one distinct field (e.g. compound headers like "Nombre y Apellido" still fall through to the existing positional-name fallback). Added to `demoSpreadsheetParser.ts` (`findFuzzyFieldMatch`) and `data_normalizer.py`/`parser.py` (`find_fuzzy_field_match`, wired into `BatchParser.map_row`).
2. **Phone ↔ extension value reconciliation:** some sheets have the headers right but the values swapped (a full number under "Ext", a 2-5 digit extension under "Teléfono"). Added `reconcilePhoneAndExtension` (Demo) / `DataNormalizer.reconcile_phone_and_extension` (Normal, called before `normalize_phone` in `map_row`) — swaps or moves values based on digit-length shape (`<=5` digits ⇒ extension-shaped, `>=7` digits or leading `+` ⇒ phone-shaped), deliberately leaving the ambiguous 6-digit middle untouched.
3. **CSV/paste flexibility (Normal mode):** `.csv` previously always assumed row 0 was the header (no preamble/title-row skipping, unlike Excel); fixed to run the same `find_header_row` detection CSV uses for Excel. Pasted plain text (`.txt` fallback, used for copy-paste) previously only tried tab-delimited; added comma/semicolon/tab auto-detection (`_detect_delimiter`, mirrors Demo's `detectDelimiter`) plus the same header-row detection. Both now read the raw pre-scan via `csv.reader` (not `pd.read_csv(header=None)`) because ragged preamble rows (fewer columns than the data rows) previously raised a hard "Expected N fields, saw M" tokenizer error.
4. **Import now persists immediately** (`CanvasControls.tsx` `handleImportJSON`): after `loadTemplate(newTemplate)`, calls `templateService.saveTemplate({ name, templateData: newTemplate })` (routes to `demoTemplateRepository` in Demo, to the DB/S3-backed endpoint in Normal — both already mint a fresh persisted ID), then `updateTemplateId(metadata.id)` + `markAsSaved()`. On persistence failure, the import still succeeds in-editor but the user is explicitly warned it is session-only. Deliberately does **not** reuse `handleSaveTemplate`'s live-canvas snapshot (`canvasWidth`/`currentTemplate` closures would still hold the *previous* template immediately after import, since Zustand `getState()` updates don't retroactively fix an already-captured closure) — persists the freshly-imported `Template` object directly instead, which is already fully resolved (ZIP images as embedded data URLs, legacy JSON as originally saved).
5. Added regression tests: `demoSpreadsheetParser.test.ts` (+16 new, incl. one that caught a real bug below), `api-server/batch-parsing/test_batch_parsing.py` (new, 17 tests — no pre-existing Python test infra existed for batch-parsing before this).

**Bug caught by the new tests (fixed before completion):** the TS fuzzy matcher's substring pass had no minimum length check on the *header token* itself (only on the alias being matched against), so a short token like `"de"` (from "Numero de Extension") substring-matched into unrelated long aliases (`"department"`/`"departamento"` both contain "de"), creating false ambiguity that suppressed a valid match. Fixed by skipping the substring pass entirely for tokens shorter than the length floor (the Python version already had this guard correctly).

**Verification (inside the running dev containers, no host node/python commands used):**
- `docker compose ... exec api-server ... python3 -m unittest test_batch_parsing -v` → **17/17 passed**.
- `docker compose ... exec front-cards ... npx jest` (full suite) → **13 suites / 114 tests passed**, 0 failed. (Global coverage-threshold gate still fails — confirmed via `git stash` baseline this is **pre-existing** (29.2%→31.2% stmts, i.e. this session's changes *raised* coverage; the repo-wide 40% gate was already failing before this session, unrelated to this work).
- `npx eslint` on all touched files: diffed against `git stash` baseline for `CanvasControls.tsx` — **byte-identical output** (26 pre-existing problems, 0 new); demo parser files: 0 errors.
- `npx tsc --noEmit` (one-off `docker compose run` with `NODE_OPTIONS=--max-old-space-size=460` to avoid the container's memory-cap OOM): diffed against `git stash` baseline — **identical 15 pre-existing errors** (DesignCanvas.tsx/PropertyPanel.tsx/ElementsLayerManagerModal.tsx/batchExportService.ts/recordSearcher.test.ts/demoSpreadsheetParser.test.ts blob-type warnings), zero new errors.
- No Python lint config exists in this repo (`ast.parse` syntax-checked the 3 changed files instead).

**Blockers:** none

**Residual / unverified (not covered by this pass):**
- **No live browser click-through** for the import-persistence fix: could not unit-test `demoTemplateRepository.saveTemplate`/`templateService.saveTemplate` directly because both paths touch `indexedDB`, which jsdom (this repo's jest environment) does not implement, and no `fake-indexeddb`-style polyfill dependency exists in the project — adding one was out of scope without asking. Verified by code reading + `tsc`/`eslint` only. **Recommended manual check:** import a `.zip`/`.json` design (Demo and Normal), close the tab immediately without clicking Save, reopen in a new tab/session, confirm the design appears in Open Template and loads correctly.
- Fuzzy header matching and phone/ext reconciliation are deliberately conservative (skip on ambiguity/mid-range digit counts) — by design, to avoid ever silently corrupting a field that was already correct; a small number of real-world label variants may still fall through unmapped rather than being guessed.
- This is layered on top of, not a replacement for, the pre-existing per-field alias lists — genuinely novel/very short field labels (e.g. bare "Fax", not in either alias list at all) are still unmapped, unchanged from before.
- Uncommitted: this entire change set is still in the working tree, not committed or pushed (see git status in Session status above).

**Next recommended:** manual browser click-through per above; then `@session-control close commit` when the user is ready to persist this work into git history (push only if explicitly requested).

---

## Prior cross-framework action (@x-director) — 2026-07-16 import duplicate

**Request:** fix demoStore defined multiple times in resourceManager.ts  
**Result:** duplicate imports consolidated.  

---

## Prior cross-framework action (@x-director) — 2026-07-16 M4 verify

**Request:** "perform full verification of all changes done today; verify Demo mode (DEMO_MODE=false/true); resolve/fix issues"  
**Result:** M4 verify + demo export/package fixes + jest OOM guard; see audit history.  

---

## Latest action (@session-control close)

**Date:** 2026-08-12 (PM)
**Request:** `@session-control close commit push`
**Session result:** Closed. Implemented the owner-approved import-ux plan end-to-end (Passes 0–6): baseline hardening (env-leak test, `is_public` migration, unmapped-column preservation, canonical field list + parity tests) → template XLSX downloads + transposed parsing → `.vcf` vCard import → field-mapping (preview API, explicit mapping, presets, modal, Demo parity) → template kinds + fork-on-save → role-gated global templates (`app_roles` + `validate-token`, API + bundled channels) → Playwright smoke + docs + risk registry. Final gates reproduced twice with zero flake: python 64 OK (+1 expected in-container skip), api 207/0/3, front 307/45 suites, front tsc clean, prisma 5 migrations clean, eslint zero new issues. 4 gap tests added during the final audit (transposed+mapping combined, inspect-on-transposed, demo vcf/mapping round-trips). Walkthrough docs for the planned cross-LLM verification: `.work/plans/20260812-import-ux-templates-list.md` + `-highlights.md`. `.work/` committed + pushed; app code committed + pushed in a separate `feat` commit; `.work.ui/` closed via `@ui-session close commit push`.
**Blockers remaining:** full Playwright run needs CI (Alpine/musl dev container); live `app_roles`/`validate-token` check against real tools-dashboard (dev+prd); browser click-throughs; Express batch-import routes deletion approval; stale `nginx` row decision; `.qwen/` gitignore decision; prd redeploy + Cassandra check (carried from 2026-08-01)

---

## Cross-LLM verification

- **Triggered:** no
- **Result:** -
- **Notes:** -
