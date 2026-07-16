# HANDOFF - session boundary

## Session status

**Closed:** 2026-07-16 — Thin-client migration complete: removed vendored `.ai/` / `.ai.ui`, lean `.cursorrules` with source pointers, carriers/registries reconciled for reliable sessions.

**Updated:** 2026-07-16

**Repository state:** Thin-client Agent OS / UI OS / SOC. Master plan Approved; M3 complete. Local framework trees deleted. Residual product gaps: Fabric render TODO, batch-import placeholder HTTP layer. Owner still owns U3/U4.

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
6. Read `.work/plans/ASSUMPTIONS.md`, `RISK_REGISTRY.md`, `UNKNOWNS.md`.

End with **`@session-control close`** (add `commit` / `commit push` only when requested).

### Conditional reads

| If the task touches… | Read first |
|----------------------|------------|
| Product scope / foundation | `.work/plans/foundation/*-01-*.md` … `*-04-*.md` |
| Any code or new feature | `.work/standards/CONVENTIONS.md`, `.ai/standards/*FEATURE_STANDARD*` |
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
| 1 | Confirm active-dev vs maintenance mode (U3) | Priority / NEXT ordering | owner |
| 2 | Confirm production deployment target (U4) | Prod ops / hosting | owner |
| 3 | Optional: refine `opencode.json` MCP if unused | Editor config | eng |

---

## What this cycle produced (audit history - skim last session only)

| Date | Session | Artifacts |
|------|---------|-----------|
| 2026-04-27 | Claude → Agent OS migration | `.work/` populated; `.cursorrules` configured |
| 2026-04-27 | @plan-repair / @plan-master | Foundation + Approved master plan M1–M3; registries |
| 2026-04-27 | @code-implementation (M1-M3) | Render/storage/import/hardening artifacts (see RISK for residual gaps) |
| 2026-06-11 | Backup/Restore fix | `bin/start.sh` restore + volume fixes |
| 2026-06-12 | Production readiness + option 4 cleanup | creds/configs; `bin/start.sh` teardown |
| 2026-07-16 | Thin-client context verify + close | Removed `.ai/` + `.ai.ui` submodule; `.work/standards/`; lean `.cursorrules`; HANDOFF/NEXT/UNKNOWNS/RISK/ASSUMPTIONS; `opencode.json`; `.work.soc/` scaffold |

---

## Explicit unknowns (promoted from UNKNOWNS)

| ID | Summary | Blocks | Status |
|----|---------|--------|--------|
| U1 | Stack pins in DOCS_TECH_STACK | docs polish | Resolved 2026-07-16 |
| U2 | CI platform | M3-T1 | Resolved 2026-07-16 |
| U3 | Active dev vs maintenance | Priority | Open |
| U4 | Production deployment target | Ops | Open |
| U5 | Test coverage targets | M3-T2 | Resolved 2026-07-16 |
| U6 | `/api/diagnostics` undocumented | Docs | Open |

---

## Cross-LLM verification

- **Triggered:** no
- **Result:** -
- **Notes:** -
