# Design system catalog

**Status:** Draft (approved) · **Updated:** 2026-08-14 · **Needs:** nothing — UU2 resolved (CATALOG-only), native-first (no new deps), owner 2026-08-14 · **Path:** `.work.ui/design-system/CATALOG.md`

Seeded by `@ui-design-system init` from foundation doc 03 (needed primitives, refined tier). Paths are proposed (`front-cards/components/ui/`) — created by S0 (`@ui-component-build plan - S0`). Token binding: all rows use **token names** from `.work.ui/design-system/tokens.json`, never literals (doc 02).

| Component | Tier | Path | Variants | Behavior source | Storybook | a11y notes |
|-----------|------|------|----------|-----------------|-----------|------------|
| AppShell | compound | `front-cards/components/ui/AppShell.tsx` | header + content; demo banner slot | none (layout) | N/A (CATALOG-only) | header landmarks (`<header>`/`<main>`); 44px targets |
| Card | primitive | `front-cards/components/ui/Card.tsx` | default, interactive (pressable) | none (container) | N/A (CATALOG-only) | focus ring on interactive variant; aria role optional |
| Button | primitive | `front-cards/components/ui/Button.tsx` | primary / secondary / ghost / danger; sizes sm-md | native `<button>` + ds styles | N/A (CATALOG-only) | visible focus (accent ring); aria-pressed for toggle; ≥44px |
| Badge | primitive | `front-cards/components/ui/Badge.tsx` | status: success/warning/error/info/neutral; icon+label | none (display) | N/A (CATALOG-only) | never color-only (UIS-04) — icon or label with every color |
| Modal | primitive | `front-cards/components/ui/Modal.tsx` | confirm / form / wide | hand-rolled overlay + focus trap + Esc (no dep) | N/A (CATALOG-only) | focus trap; Esc; `aria-labelledby`; scrim = `--surface-overlay` + scrim token |
| Input / Textarea | primitive | `front-cards/components/ui/Input.tsx` | text, password, number, textarea | native + `--surface-inset` styles | N/A (CATALOG-only) | label `for`/`aria-labelledby`; error text association; `aria-invalid` |
| Select | primitive | `front-cards/components/ui/Select.tsx` | default, disabled | native `<select>` + ds styles (waiver until built) | N/A (CATALOG-only) | APG listbox; keyboard arrows; visible option state |
| SearchBar | primitive | `front-cards/components/ui/SearchBar.tsx` | debounced (300ms), clearable | native input + debounce hook | N/A (CATALOG-only) | `role="search"`; clear button labelled; live region optional |
| DataTable | primitive | `front-cards/components/ui/DataTable.tsx` | sortable, row-select, paginated | native `<table>` + ds styles | N/A (CATALOG-only) | `caption` or `aria-label`; `scope` headers; sticky header note |
| Pagination | primitive | `front-cards/components/ui/Pagination.tsx` | prev/next, numbered | native buttons + ds styles | N/A (CATALOG-only) | `aria-current="page"`; current page not color-only |
| Progress | primitive | `front-cards/components/ui/Progress.tsx` | bar (usage), threshold state | native `<progress>` + ds styles | N/A (CATALOG-only) | `aria-valuemin/max/now`; value readout beside bar |
| Skeleton / LoadingState | primitive | `front-cards/components/ui/LoadingState.tsx` | skeleton, spinner, inline | none (presentation) | N/A (CATALOG-only) | `aria-busy`; `role="status"`; never bare "Loading…" text |
| ErrorState / EmptyState | primitive | `front-cards/components/ui/StatePanel.tsx` | error (retry), empty (cta) | none | N/A (CATALOG-only) | error copy = what happened + next action; focus moves to panel |
| SectionHeader | primitive | `front-cards/components/ui/SectionHeader.tsx` | default, toggle (accordion) | native `<button aria-expanded aria-controls>` | N/A (CATALOG-only) | heading level prop; accordion region labelled |
| Toggle / SegmentedControl | primitive | `front-cards/components/ui/Toggle.tsx` | on/off, segmented | native checkbox / radio-group + ds styles | N/A (CATALOG-only) | APG switch; `aria-checked`; label association |
| RangeSlider | primitive | `front-cards/components/ui/RangeSlider.tsx` | default, min-max | native `<input type=range>` + ds-range.css (custom anatomy, no dep) | N/A (CATALOG-only) | APG slider; value readout visible (not thumb-only) |
| IconButton | primitive | `front-cards/components/ui/IconButton.tsx` | sizes, danger | native `<button>` + ds styles | N/A (CATALOG-only) | `aria-label` mandatory; visible focus |

**Extraction sources (S0):** Modal ← existing `SaveTemplateModal`/`OpenTemplateModal`/`FieldMappingModal`/`RecordEditModal`; AppShell ← 4 hand-copied page headers; Badge ← `BatchStatusBadge`/`RenderStatusBadge`; Progress ← dashboard usage bars; LoadingState ← `ProtectedRoute` spinner + `QuickActions` overlay.

**Behavior source policy (owner 2026-08-14):** **native-first, zero new dependencies** — primitives use native HTML elements + ds styles (custom anatomy via tokens for range/select/checkbox where craft ≥ refined); Modal focus trap/Esc hand-rolled. Style always from project tokens.

## Next action

Resolve UU2 (Storybook vs CATALOG-only) → `@ui-component-build plan - S0` (primitives) → `add`/build per this catalog
