# Batches — Screen SPEC

**Status:** Approved  
**Needs:** nothing — owner-approved 2026-08-14 (decisions below); build gated on S2 (Pagination primitive)  
**Slug:** batches  
**Path:** `.work.ui/screens/batches/20260814-SCREEN-SPEC.md`

---

## 1. Summary

The batches screen (`/batches`) is where the operator manages uploaded recipient lists. It shows all batches as a filterable, paginated card grid with live status (UPLOADED → PARSING → PARSED → LOADED / ERROR), opens the records view, and deletes batches. Entry points: dashboard **Quick Actions → View Batches**, and post-import. (Uploading a new batch happens on `/dashboard` via `UploadBatchComponent` — the "Upload New" button routes back to `/dashboard` per decision 1: single import surface.)

## 2. Personas & jobs

| Persona | Job |
|---------|-----|
| Batch operator | See all batches + status at a glance, find one (search/status filter), open records, delete mistakes |
| Demo visitor | Browse the demo's own batches (browser-persisted) without server writes — same flows, demo adapters |

## 3. States

| State | Behaviour |
|-------|-----------|
| loading | Card skeletons (2+ pulsing `surface-inset` blocks) — replace with `StatePanel kind="loading"` or skeleton primitives (no bare "Loading…") |
| empty (no filters) | Icon + "No batches found" + "Get started by uploading your first batch" CTA → `/dashboard` |
| empty (filters active) | "No batches found" + "Try adjusting your filters" — filters stay visible so the operator can clear them |
| error | "Failed to load batches" + message + **Retry** (`refetch`) — `StatePanel kind="error"` |
| success | Card grid + results count ("Showing N of M") + refresh; pagination when `totalPages > 1` |
| partial | Refresh re-fetches in place; cards show per-batch status live (badge may change after parse) |

## 4. Layout & hierarchy

`AppShell` chrome (header: home nav, title "Batches", `PageHeaderActions`, "Upload New" `Button`); content column:

| Region | Priority | Example id | Notes |
|--------|----------|------------|-------|
| App header (home, title, lang switcher, Upload New) | 0 | dashboards/D2 | Upload New = primary action (accent) |
| Filters (SearchBar + status Select + Clear) | 1 | dashboards/D13 | stacked on mobile, row on sm+ |
| Results bar (count + Refresh) | 2 | dashboards/D2 | |
| Batch card grid | 3 | dashboards/D2 | 1 col mobile → 2 md → 3 lg |
| Pagination | 4 | dashboards/D5 | bottom, prev/next + numbered |

Breakpoints: filters `flex-col sm:flex-row`; grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; pagination collapses to prev/next only on mobile (UIS-01, UIS-02).

## 5. Content

i18n keys (EN + ES parity — `features/i18n/messages/{en,es}.ts`): `batches.title`, `uploadNew`, `homeAria`, `searchPlaceholder` ("Search by file name…"), `filterStatusLabel`, `allStatuses`, `clearFilters`, `showingXofY` ("Showing {n} of {total}"), `refresh`, `noBatches`, `noBatchesHint` (existing), `filteredNoBatchesHint`, `pageXofY`, `previous`, `next`, `deleteConfirmTitle`/`deleteConfirmBody`/`deleteCancel`/`deleteConfirm` (delete uses Modal), `status.uploaded/parsing/parsed/loaded/error`.

Copy rules: status labels capitalized with icon in badge (never color-only — UIS-04); empty-state copy differs by whether filters are active.

## 6. Interactions

- Filter change (search debounced 300ms via `SearchBar`; status `Select`) → **reset page to 1** (today: `handleFiltersChange` does this — keep).
- Pagination page change → scroll to top (`window.scrollTo({top:0,behavior:'smooth'})` — keep).
- Batch card → `/batches/[batchId]/records` (records SPEC next).
- Delete → confirm `Modal` (focus trap, Esc) → API delete → `refetch()`.
- Refresh button → `refetch()` in place.
- Keyboard: cards are real links/buttons; filter controls labelled (`sr-only` today — replace with visible labels); pagination `aria-current="page"`.

## 7. Data dependencies

- `useBatches` hook + `BatchListFilters`/`BatchStatus` types — `.work/features/from-claude/batch-view/` (list SPEC link)
- Delete API — batch-view feature SPEC
- Demo mode: same hooks, demo adapters (`.work/features/demo-local-persistence/20260716-SPEC.md`)

## 8. Tokens & components

Tokens: `--surface-*`, `--elevation-shadow-*`, `--border-*`, `--status-*`, `--accent-*`, `--text-*` (foundation doc 02 / `tokens.json`).

| Component | Catalog status | Waiver |
|-----------|----------------|--------|
| AppShell | done (S0) | — |
| Card | done (S0) | — |
| Badge (status) | done (S0) | — |
| SearchBar | done (S0) | — |
| Select | done (S0) | — |
| StatePanel | done (S0) | — |
| Button | done (S0) | — |
| Modal (delete confirm) | done (S0) | — |
| Pagination | **planned (built in S2)** | native prev/next buttons allowed as interim only within S2

## 9. Accessibility

WCAG AA (assumption — foundation UA1, to be measured). Status badges icon+label (UIS-04); visible filter labels (replace `sr-only`); focus ring accent; delete Modal focus trap/Esc; pagination current page not color-only (`aria-current`); touch targets ≥44px; no horizontal overflow at 360px (filters stack).

## 10. Analytics

`batches_view` · `batch_filter_changed{status\|search}` · `batch_opened` · `batch_deleted` · `upload_new_clicked` · `refresh_clicked` (no PII).

## 11. Acceptance criteria

- [ ] All regions use `surface-elevated`/`elevation-shadow-2` tokens; no raw hex/`shadow-md` (D2: soft card elevation on light background)
- [ ] Status shown as `Badge` (icon + label + semantic color), never color-only (D1: status legend not color-only)
- [ ] Filtering: SearchBar (300ms debounce) + status Select; any change resets to page 1 (D13: filter chips row collapses on mobile)
- [ ] Empty state branches: no filters → upload CTA; filters active → "adjust your filters" (D13)
- [ ] Error state: `StatePanel kind="error"` with Retry (D10: error with retry action)
- [ ] Loading: skeleton cards, no bare "Loading…" (doc 01 principle 1)
- [ ] Pagination: prev/next + numbered, `aria-current="page"`, collapses to prev/next on mobile; page change scrolls to top
- [ ] Delete: Modal confirm (focus trap, Esc) → delete → list refetches; cancel keeps list
- [ ] Upload New → `/dashboard` (decision 1: single import surface — do not embed a second `UploadBatchComponent` on `/batches`)
- [ ] EN + ES copy parity (§5); header responsive ≥44px targets
- [ ] Data flow: `handleFiltersChange` resets page; `useBatches` refetch keeps pagination state sane

## 12. Concept / UIS registry

| UIS | Applies | Reason | Status |
|-----|---------|--------|--------|
| UIS-01 | yes | new layout/scan path | pending |
| UIS-02 | yes | mobile filter stack + pagination collapse (public Demo) | pending |
| UIS-03 | no | minimal motion — smooth scroll only | N/A |
| UIS-04 | yes | status not color-only | pending |
| UIS-05 | no | no form fields; delete confirm is a Modal interaction | N/A |
| UIS-06 | yes | agent build | pending |
| UIS-07 | yes | craft tier refined | pending |
| UIS-08 | yes | all screens before ship | pending |
| UIS-09 | no | not analytical | N/A |
| UIS-10 | no | no creative hero | N/A |

## 13. Visual references

| Field | Value |
|-------|-------|
| **exampleIds** | `dashboards/D1`, `dashboards/D2`, `dashboards/D13` |
| **manifestPaths** | `.ai.ui/examples/dashboards/manifest.md` |
| **craftTier** | refined |
| **beforeScreenshot** | `inputs/design-references/batches-before.png` (optional) |

### extractedRules (binding, subset for this screen)

- **D1** — Status shown with legend/icon, never color-only.
- **D2** — Soft card elevation on light background; card grid 2–3 cols; status badges + row highlight (cards highlight on hover/focus).
- **D13** — Filters collapse on mobile; empty state gives guidance, not blank space.

### regionMap

| §4 region | example id |
|-----------|------------|
| App header | dashboards/D2 |
| Filters | dashboards/D13 |
| Results bar | dashboards/D2 |
| Batch card grid | dashboards/D2 |
| Pagination | dashboards/D5 |

### Figma / external (optional)

- (none)

## 14. Data visualization

**N/A** — card grid + counts, no charts. Count text readouts (results count, per-card counts) use `text-text-*` tokens; chart rules apply to records screen if charted later.

---

## Decisions (owner, 2026-08-14)

1. **Upload New keeps routing to `/dashboard`** — single import surface (`UploadBatchComponent` + paste + name + mapping modal lives there); do not fork a second import on `/batches`.
2. **List presentation: cards** (current, D2 line-items-as-cards) — not `DataTable`; `DataTable` reserved for the records screen (dense scanning).
3. **Pagination: build the `Pagination` primitive in S2** (D5 pattern, reusable for records); native prev/next allowed only as interim within S2.

## Next action

`@ui-screen-spec review - .work.ui/screens/batches/20260814-SCREEN-SPEC.md`
