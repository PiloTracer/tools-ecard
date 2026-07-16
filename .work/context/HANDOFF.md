# HANDOFF - session boundary

## Session status

**Closed:** 2026-07-16 — Session opened for prod-deploy pick-up; diagnosed slow clone (local `node_modules` ~9GB+ / `.opencode` not in git; GitHub pack ~3MB). No deploy cutover performed.

**Updated:** 2026-07-16

Treat the next chat as a **new session**: do not assume unwritten goals from prior threads unless they appear in this file or linked artifacts.

**Repository state:** Thin-client Agent OS / UI OS / SOC. Master plan Approved; **M3 + M4 complete**. Demo + prd restore path ready. Engineering ready for `./bin/start.sh prd up` when operator owns DNS/TLS. Residual: Fabric render TODO, batch-import placeholders, U6 diagnostics docs. Local working tree ~11GB (ignored `node_modules`) — does not affect `git clone` size.

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
| 3 | Document `/api/diagnostics` (U6) | Docs | eng |

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
**Request:** "perform full verification of all changes done today; verify Demo mode (DEMO_MODE=false/true); resolve/fix issues"  
**Frameworks involved:** .ai  
**Classified framework bucket(s):** engineering (cross-cutting verify + repair)  
**Routing confidence:** high  
**Preflight (frameworks installed):** .ai yes | .ai.ui yes | .ai.biz no | .ai.soc scaffold only  

**Executed:**
1. `@code-verify` (milestone/last) on M4 commit `74517b1` — SPEC R1–R12 matrix, compose tests, live API probes  
2. `@code-repair` — demo gaps in `batchExportService`, `templatePackageService`; BFF proxy integration test; jest `maxWorkers: 1` (api-server + front-cards)  

**Coordination notes:** UI layer verified via front-cards unit tests + service wiring audit; no `.work.ui` writes.  

**Verification evidence:**
- `DEMO_MODE=false`: health `demoMode:false`; POST `/api/v1/projects` → 201; front-cards `:7300` → 200  
- `DEMO_MODE=true`: `demoModeGuard` unit tests pass; tsx inline `isDemoModeEnabled()` → true; BFF `proxyRequestToApiServer` POST → 403 `demo_mode_readonly` (new test)  
- api-server: 13 suites / 137 tests pass (`NODE_OPTIONS=--max-old-space-size=768` in tight dev container)  
- front-cards: 11 suites / 93 tests pass (`--runInBand` / `maxWorkers:1`)  

**Fixes applied (uncommitted):**
- `batchExportService.fetchBatchRecords` routes through `batchRecordService` in demo (was hitting api-server)  
- `templatePackageService` reads demo blobs/fonts for `demo-blob://` URLs and demo font IDs  
- `proxy-to-api-server.test.ts` asserts POST blocked before upstream  
- `jest.config.js` `maxWorkers:1` on api-server and front-cards (prevents SIGKILL/OOM killing dev servers during `npm test`)  

**Blockers:** none for dev verification; owner clean public Demo deploy (both env flags) still pending for prod cutover  

**Next recommended:** `@session-control start` → owner clean Demo deploy; or `@code-implementation plan` for M1/M2 residual gaps  

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
