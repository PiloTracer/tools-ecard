# HANDOFF_UI — UI design session boundary

> **Path:** `<repo-root>/.work.ui/context/HANDOFF_UI.md` · Maintained by **`ui-*` skills**. Session bookends: **`@session-control`** when `.ai/` is present.

## Session status

**Open:** closed

**Updated:** 2026-08-14

**Closed:** 2026-08-14

**UI layer state:** Bootstrap complete — ready for foundation. Thin-client: `AI_UI_SOURCE=/mnt/work/Projects/.ai.ui`.

**Recommended pick-up:** `.work.ui/plans/NEXT_UI.md`

**Lost or new?** Read `.ai.ui/START_HERE.md` (via `$AI_UI_SOURCE`)

---

## UI readiness

| State | Value | Date |
|-------|-------|------|
| ui-foundation-complete | yes | 2026-08-14 |
| screen-spec-ready | yes | 2026-08-14 |
| ui-implementation-ready | no | |

## UI foundation state

| Item | Value |
|------|-------|
| Docs 01–04 | `.work.ui/plans/foundation/20260814-{01-ui-vision-and-principles,02-design-tokens,03-pattern-inventory,04-screen-map}.md` |
| Craft tier | **refined** (doc 01) |
| Example ids | **D2, D13, D1, C1** (doc 03 rows) |
| Token file | `front-cards/app/globals.css` (canonical source `.work.ui/design-system/tokens.json` — DTCG, 104 tokens, schema-verified) |
| Style stack | tailwind (v4, CSS-first `@theme`) |
| Archetype / complexity | saas-product / M |

## Active UI milestone

- **Milestone:** (none)
- **NEXT_UI:** [.work.ui/plans/NEXT_UI.md](../plans/NEXT_UI.md)

---

## Fresh start — first actions (UI)

1. **`@session-control start`** when `.ai/` is present.
2. Read **`.cursorrules`** (UI block or full UI template).
3. Read **this file** and `.work.ui/plans/NEXT_UI.md`.
4. If foundation missing: **`@ui-design-foundation greenfield`**.
5. Close with **`@session-control close`** (optional commit).

### Conditional reads

| If the task touches… | Read first |
|----------------------|------------|
| Tokens / theme | `.work.ui/plans/foundation/*-02-design-tokens.md` |
| Screen map | `.work.ui/plans/foundation/*-04-screen-map.md` |
| Building UI | Approved `.work.ui/screens/<slug>/*-SCREEN-SPEC.md` |
| API behaviour | `.work/features/<slug>/*-SPEC.md` (link only) |
| Stack / commands | `DOCS_UI_STACK.md` |

---

## Open owner actions (UI)

| # | Action | Blocks | Owner |
|---|--------|--------|-------|
| - | (none) | | |

---

## What this cycle produced (UI)

| Date | Session | Artifacts |
|------|---------|-----------|
| 2026-08-14 | ui-session (S0–S4 complete) | 15 primitives + 4 screen rebuilds (dashboard, batches, batch-records, template-designer) from 4 Approved SPECs; tokens live in globals.css; token-lint 0 chrome scope; 62 suites/353 tests; visual+a11y audits pass; remaining: lint debt + data-hex docs |
| 2025-06-11 | bootstrap | `.work.ui/` skeleton, DOCS_UI_STACK.md, merged .cursorrules |

---

## Repository UI state

- **Archetype:** saas-product · **Complexity:** M
- **Style stack:** tailwind · **Date:** 2026-08-14
- **Token file:** front-cards/app/globals.css
- **Catalog:** `.work.ui/design-system/CATALOG.md`
- **Last visual verify:** pass 2026-08-14 (milestones S1–S4; owner-reported defects — Import Batch contrast, Settings labels, designer toolbox label inconsistency — found + fixed; token-lint 0 literals in milestone chrome scope)
- **Last a11y audit:** pass 2026-08-14 (static WCAG/APG rubric S1–S4; jest-axe not installed — no new deps per owner; live-browser axe requires opt-in §8.2; pre-existing lint debt in CanvasControls/PropertyPanel flagged for cleanup)
- **ADR location:** `.work.ui/decisions/` (default)

---

## Cross-link (Agent OS)

Keep **### UI layer** in `.work/context/HANDOFF.md` in sync when milestones close.
