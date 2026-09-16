# NEXT_UI — UI planning backlog

> **Path:** `<repo-root>/.work.ui/plans/NEXT_UI.md` · **`@ui-component-build`** owns `## Current UI iteration`.

**Updated:** 2026-09-15 (completed S4 iteration moved to archive)

---

## Done (UI)

| Item | Artifact |
|------|----------|
| Cycle S0–S4 — 16 primitives + 4 screens rebuilt (dashboard, batches, batch-records, template-designer) from 4 Approved SPECs | `.work.ui/screens/*/20260814-SCREEN-SPEC.md`; `HANDOFF_UI.md` § What this cycle produced |
| UI bootstrap | `.work.ui/` skeleton |

---

> **Completed iteration moved.** S4 (template-designer) and its task/UIS/done tables now live in [`NEXT_UI.archive.md`](NEXT_UI.archive.md) (Context budget: history is moved, never deleted).

---

## Blocked on owner (UI)

| # | Item | Notes |
|---|------|-------|
| - | (none) | |

---

## Recommended next

| Priority | Item | Notes |
|----------|------|-------|
| **0** | **Session close** — `@ui-session close` + `@session-control close` (both bookends open since 2026-08-14) | cycle S0–S4 complete; audits banked |
| **1** | Pre-existing lint cleanup: CanvasControls (63KB) + PropertyPanel ≈40 errors (`no-explicit-any`/immutability) | flagged in audits; not blocking runtime |
| **2** | `@ui-visual-verify` with browser opt-in (§8.2) — live click-through of S1–S4 | needs your go-ahead |
| **3** | Designer data-layer hex → documented token-file exceptions (45 literals) | stores/utils/DesignCanvas persisted values |
| **4** | Next cycle: i18n deep-pass on designer internals (toolbox/panels hardcoded strings) + `template-designer` dark-chrome re-theme | |

---

## Intake queue

> Free-text UI requests captured by `@ui-screen-spec intake - <sentence>`. Format: `- <YYYY-MM-DD> · <class> · "<sentence>" → <next command>`. Classes: local / cross-cutting / brownfield / underspecified.

- (none yet)

---
