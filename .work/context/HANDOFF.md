# HANDOFF - session boundary

## Session status

**Closed:** 2026-07-16 - Demo mode card-generation reliability bugs found and fixed (font preload, XLSX self-closing-cell regex bug, name-field mapping); verified against user's real file; not yet manually clicked-through in browser. (Separately this same day: clone-size diagnosis session confirmed `node_modules`/`.opencode` are not in git and GitHub pack is small; no deploy cutover performed.)

**Updated:** 2026-07-16

Treat the next chat as a **new session**: do not assume unwritten goals from prior threads unless they appear in this file or linked artifacts. Treat prior closed sessions as historical only; see "What this cycle produced" below.

**Repository state:** Thin-client Agent OS / UI OS / SOC. Master plan Approved; **M3 + M4 complete** (incl. post-M4 verify fixes + this session's Demo reliability fixes). Demo mode + prd restore runbook + triple write barriers. `.env.prd` passes `bin/verify-prd-env.sh`. Engineering ready for `./bin/start.sh prd up` when operator owns DNS/TLS. Residual: Fabric render TODO, batch-import placeholders, U6 diagnostics docs, live-browser click-through of today's Demo fixes still pending. Local working tree ~11GB (ignored `node_modules`) — does not affect `git clone` size. Source pointers: `/data/Projects/.ai` (+ `.ai.ui` / `.ai.soc`).

**Recommended pick-up file:** `.work/plans/NEXT.md`

**Lost or new?** Read `.ai/START_HERE.md` (via `$AGENT_OS_SOURCE=/data/Projects/.ai`).

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
| 3 | Document `/api/diagnostics` (U6) | Docs | eng |
| 4 | Manual browser click-through of today's Demo fixes (upload real `.xlsx`, run batch export, visually confirm name + font on output PNG) | Confidence in Demo fix | eng/owner |
| 5 | Pre-existing `traceability-verify.sh` gap: FR1-FR4, FR7-FR10 not mapped to `M{N}-T{N}` tasks in master plan (unrelated to this session's work; found while running the close pre-check) | Plan hygiene | eng |

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

---

## Explicit unknowns (promoted from UNKNOWNS)

| ID | Summary | Blocks | Status |
|----|---------|--------|--------|
| U1 | Stack pins in DOCS_TECH_STACK | docs polish | Resolved 2026-07-16 |
| U2 | CI platform | M3-T1 | Resolved 2026-07-16 |
| U3 | Active dev vs maintenance | Priority | Resolved 2026-07-16 — active-dev for M4 |
| U4 | Production deployment target | Ops | Resolved 2026-07-16 — prd procedure documented; DNS/TLS operator-owned |
| U5 | Test coverage targets | M3-T2 | Resolved 2026-07-16 |
| U6 | `/api/diagnostics` undocumented | Docs | Open |

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

## Prior cross-framework action (@x-director) — 2026-07-16 import duplicate

**Request:** fix demoStore defined multiple times in resourceManager.ts  
**Result:** duplicate imports consolidated.  

---

## Prior cross-framework action (@x-director) — 2026-07-16 M4 verify

**Request:** "perform full verification of all changes done today; verify Demo mode (DEMO_MODE=false/true); resolve/fix issues"  
**Result:** M4 verify + demo export/package fixes + jest OOM guard; see audit history.  

---

## Latest action (@session-control close)

**Date:** 2026-07-16  
**Request:** `@session-control close commit push`  
**Session result:** Closed; no product code changes. Clone-size diagnosis only (local deps ≠ git).  
**Production readiness:** Unchanged — engineering ready for `./bin/start.sh prd up` when operator owns DNS/TLS and deploy path.  
**Blockers remaining:** U6; DNS/TLS; owner deploy / Demo cutover  

---

## Cross-LLM verification

- **Triggered:** no
- **Result:** -
- **Notes:** -
