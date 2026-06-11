# HANDOFF - session boundary

## Session status

**Open:** 2026-04-27 — goal: migrate .claude/ content to .work/ layout, fill .cursorrules REPLACE tokens

**Updated:** 2026-04-27

**Closed:** 2026-04-27 — .claude → .work migration complete; .cursorrules configured

**Repository state:** `.work/` populated from `.claude/`, `.cursorrules` configured, `.claude.deprecated/` archived. Awaiting foundation planning.

**Recommended pick-up file:** `.work/plans/NEXT.md`

**Lost or new?** Read `.ai/START_HERE.md` (from repo root).

---

## Fresh start - what the next session should do first

1. Run **`@session-control start`** (or follow the manual list in `session-control` skill).
2. Read **`.cursorrules`**.
3. Read **P0 initial scope** when present: `.work/plans/foundation/*-01-*-initial-scope.md`.
4. Read **this file** through §Fresh start, then §Open owner actions.
5. Read `.work/plans/NEXT.md`.
6. Read `.work/plans/ASSUMPTIONS.md`, `RISK_REGISTRY.md`, `UNKNOWNS.md`.

End with **`@session-control close`** (add `commit` / `commit push` only when requested).

### Conditional reads (customize per project)

| If the task touches… | Read first |
|----------------------|------------|
| Product scope / foundation | `.work/plans/foundation/*-01-*.md` … `*-04-*.md` |
| Any code or new feature | `.ai/standards/*CONVENTIONS*`, `*FEATURE_STANDARD*` |
| External integration | `*-02-*.md`, `.ai/docs/integration/MANIFEST.txt` (if any) |
| Security | `.ai/standards/*threat-model*` |
| Stack / topology | `REPLACE:TECH_STACK_DOC` |
| Master plan / milestones | `.work/plans/full/*-full-plan.md` |
| High-risk feature | Relevant `.work/features/<slug>/*-SPEC.md` |

---

## Open owner actions

| # | Action | Blocks | Owner |
|---|--------|--------|-------|
| - | (none) | | |

---

## What this cycle produced (audit history - skim last session only)

| Date | Session | Artifacts |
|------|---------|-----------|
| 2026-04-27 | Claude → Agent OS migration | `.work/features/from-claude/`, `.work/plans/proposals/from-claude/`, `.work/operations/fixes+implementations/`, `.work/prompts/from-claude/`, `.work/analysis/`, `.work/features/specs/`, `.ai/docs/guides/from-claude-tutorials/`, `.ai/docs/integration/from-claude-remote-server/`, `.cursorrules` REPLACE tokens resolved, `.ai/standards/` merged with project-specific content, `.claude.deprecated/` archived |

---

## Explicit unknowns (promoted from UNKNOWNS)

| ID | Summary | Blocks |
|----|---------|--------|
| - | | |

---

## Cross-LLM verification

- **Triggered:** no
- **Result:** -
- **Notes:** -
