# NEXT_UI — UI planning backlog

> **Path:** `<repo-root>/.work.ui/plans/NEXT_UI.md` · **`@ui-component-build`** owns `## Current UI iteration`.

**Updated:** 2026-07-16

---

## Done (UI)

| Item | Artifact |
|------|----------|
| UI bootstrap | `.work.ui/` skeleton |

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

## Current UI iteration

**Milestone:** S4 — template-designer (SPEC `20260814-SCREEN-SPEC.md`, Approved) · **Status:** complete · **Started:** 2026-08-14 · **Completed:** 2026-08-14

Scope: rebuild `/template-textile` per the Approved SPEC — new primitives (IconButton, Toggle, RangeSlider), mobile slide-in drawers (toolbox + property panel), `beforeunload` guard, `confirm`/`alert()` → Modal/StatePanel migration, token migration of the designer chrome, i18n EN+ES. Decisions: drawers; beforeunload; confirm/alert migration. Keyboard map + fork-on-save + export pipeline preserved.

### Tasks
| ID | Description | Files | Status | Notes |
|----|-------------|-------|--------|-------|
| S4-T0 | IconButton primitive (sizes, danger, aria-label required) | `front-cards/components/ui/IconButton.tsx` (+test) | done | primitive · toolbar |
| S4-T1 | Toggle primitive (visible state, `aria-pressed`) | `front-cards/components/ui/Toggle.tsx` (+test) | done | primitive · grid/snap/lock/no-output |
| S4-T2 | RangeSlider primitive (custom anatomy per C1: track/thumb tokens + value readout) | `front-cards/components/ui/RangeSlider.tsx` (+test) | done | primitive · opacity/zoom · native range until built |
| S4-T3 | Mobile drawers: toolbox + property panel slide-in on narrow viewports (Esc closes, focus returns, canvas keeps focus) | `features/template-textile/components/TemplateDesigner.tsx`, `Toolbox/ElementToolbox.tsx`, `PropertyPanel/PropertyPanel.tsx` | done | screen · SPEC decision 1 |
| S4-T4 | `beforeunload` guard when dirty (SPEC decision 2) | `features/template-textile/components/TemplateDesigner.tsx` | done | screen |
| S4-T5 | `confirm`/`alert()` → Modal/StatePanel: dashboard Back confirm, Close/Delete confirms (already modal), canvas-taint export alert, ZIP-failure alert | `features/template-textile/components/TemplateDesigner.tsx`, `Canvas/CanvasControls.tsx` | done | screen · SPEC decision 3 |
| S4-T6 | Token migration of designer chrome (toolbar wells, toolbox/panel surfaces, badges, color pickers); toolbox `overflow-y-auto`; toolbar IconButton aria-labels; grid/snap/lock → Toggle; opacity → RangeSlider | `Canvas/CanvasControls.tsx`, `Toolbox/*`, `PropertyPanel/*`, `CanvasSettings.tsx`, `TemplateStatus.tsx` | done | screen · UIS-04/07 |
| S4-T7 | i18n EN+ES per SPEC §5 (designer.* keys: save/open/import/close/delete/batchExport/zoom/undo/redo/layers/grid/snap/background/exports/confirms/errors) | `features/i18n/messages/en.ts`, `es.ts` | done | screen |
| S4-T8 | Gate: keyboard map preserved + regression tests; token-lint/eslint/tsc/jest green (one-off container) | touched files above | done | gate |

Acceptance (per SPEC §11): token-bound chrome (token-lint 0); keyboard map §6 preserved (Ctrl+S/Z/Y/D/C/V, Delete, Esc, Tab); fork-on-save + export pipeline (viewport reset, exclude-from-export, high-res swap) unchanged; global-template affordances hidden in demo (D13); modals focus-trap/Esc; no `window.confirm`/`alert()` remain; beforeunload when dirty; drawers keyboard-accessible; toolbox scrollable; EN+ES parity; ≥44px targets.

### UIS registry (this iteration)
| UIS | Applies | Status |
|-----|---------|--------|
| UIS-01 | yes (complex layout scan) | done |
| UIS-02 | yes (mobile drawers, public Demo) | done |
| UIS-04 | yes (status/badges not color-only) | done |
| UIS-05 | yes (property-panel forms) | done |
| UIS-06 | yes (agent build) | done |
| UIS-07 | yes (craft tier refined) | done |
| UIS-08 | yes (all screens before ship) | done |

### Open (S4)
- None blocking — waivers documented (§8: native range/toggle/buttons until S4 primitives land; they land in this milestone).

---

## Done this UI iteration

| ID | Description | Completed |
|----|-------------|-----------|
| S0-T0 | Tokens → globals.css @theme (oklch, accent orange) + Geist/Arial font fix | 2026-08-14 |
| S0-T1–T12 | 12 primitives/compound in `front-cards/components/ui/` (AppShell, Card, Button, Badge, Modal, Input, SearchBar, DataTable, StatePanel, Progress, SectionHeader, Select) + 12 test suites | 2026-08-14 |
| S1-T1–T8 | Dashboard rebuild per Approved SPEC: AppShell, quick-actions hero, subscription+settings expandables, account→profile, banner once-per-login, token migration, i18n EN+ES | 2026-08-14 |
| S2-T0–T6 | Pagination primitive + batches rebuild per Approved SPEC: AppShell, filters (SearchBar/Select), StatePanel states, status Badges, Modal delete, i18n EN+ES, token migration | 2026-08-14 |
| S3-T0–T6 | batch-records rebuild per Approved SPEC: AppShell, SearchBar toolbar, DataTable with status badges + row actions, Modal edit/delete/retry, StatePanel, i18n EN+ES, token migration | 2026-08-14 |
| S4-T0–T8 | template-designer per Approved SPEC: IconButton/Toggle/RangeSlider primitives, mobile drawers, beforeunload, confirm/alert→Modal/StatePanel, i18n EN+ES, hex audit | 2026-08-14 |
| Cycle summary | S0–S4 complete 2026-08-14: 15 primitives + 4 screens rebuilt from 4 Approved SPECs; token system live (globals.css @theme, oklch); token-lint 0 in chrome scope; 62 suites/353 tests green; visual + a11y audits passed (3 owner findings fixed); remaining: pre-existing lint debt in CanvasControls/PropertyPanel (≈40), designer data-layer hex documentation | 2026-08-14 |
