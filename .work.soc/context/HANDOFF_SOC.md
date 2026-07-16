# HANDOFF_SOC — Security OS session boundary

## Session status

**Open:** -

**Updated:** 2026-07-16

**Closed:** -

**Repository state:** SOC scaffold only (thin-client `SOC_SOURCE=/mnt/work/Projects/.ai.soc`). No active SOC assessment yet.

**Recommended pick-up file:** `.work.soc/plans/NEXT_SOC.md`

**Lost or new?** Read `.ai.soc/START_HERE.md` (from repo root).

---

## Fresh start — what the next SOC session should do first

1. Run **`@session-control start`** (from `.ai/`).
2. Read **`.cursorrules`** (`.ai.soc` section).
3. Read this file through § Fresh start, then § Open owner actions.
4. Read `.work.soc/plans/NEXT_SOC.md`.
5. Read `.work.soc/plans/UNKNOWNS_SOC.md`.

End with **`@session-control close`** (add `commit` / `commit push` only when requested).

### Conditional reads

| If the task touches… | Read first |
|----------------------|------------|
| Security testing / pentesting | `.ai.soc/standards/*testing*`, Strix documentation |
| License / compliance | `.ai.soc/standards/*compliance*` |
| Threat model | `.ai.soc/standards/*threat-model*` |
| New SOC plan | `.work.soc/plans/NEXT_SOC.md` |

---

## Open owner actions

| # | Action | Blocks | Owner |
|---|--------|--------|-------|
| - | (none) | | |

---

## What this cycle produced

| Date | Session | Artifacts |
|------|---------|-----------|
| 2026-07-16 | context verify | Thin-client pointers confirmed; scaffold only |

---

## Explicit unknowns

| ID | Summary | Blocks |
|----|---------|--------|
| - | | |
