# Batch Records — Screen SPEC

**Status:** Approved  
**Needs:** nothing — owner-approved 2026-08-14 (decisions below)  
**Slug:** batch-records  
**Path:** `.work.ui/screens/batch-records/20260814-SCREEN-SPEC.md`

---

## 1. Summary

The batch-records screen (`/batches/[batchId]/records`) is where the operator inspects, searches, edits, and deletes the contact records of a single batch, and sees per-record render status. Entry: batch card **View Records** (from `/batches`); optional `?templateId=` query (render-from-template link). The header shows the batch file name + batch status badge, with navigation back to `/batches` and home.

## 2. Personas & jobs

| Persona | Job |
|---------|-----|
| Batch operator | Verify parsed records, fix errors inline (edit modal), delete bad rows, track render status |
| Demo visitor | Browse/edit the demo batch's records (browser-persisted) — same flows |

## 3. States

| State | Behaviour |
|-------|-----------|
| loading | `StatePanel kind="loading"` (no bare "Loading records…" — today: legacy Suspense fallback + skeleton cards, replace) |
| error | `StatePanel kind="error"` + Retry (`refetch`) — replaces today's red box + retry |
| empty (no search) | "No records found" + "This batch does not contain any records yet" (no CTA) |
| empty (search) | "No records found" + "Try adjusting your search query" — search stays visible |
| success | Search bar + refresh, results count ("Showing N records" / "Found N matching records"), DataTable of records |
| partial | Per-record render status badges; failed renders show retry affordance (open question 3) |

## 4. Layout & hierarchy

`AppShell` chrome (header: home nav, back-to-batches nav, batch file name + `BatchStatusBadge`, "View All Batches" `Button`):

| Region | Priority | Example id | Notes |
|--------|----------|------------|-------|
| App header (home, back, batch name + status, View All Batches) | 0 | dashboards/D2 | |
| Toolbar (SearchBar + Refresh) | 1 | dashboards/D13 | `flex` row; stacks on mobile |
| Results count | 2 | dashboards/D2 | "Showing/Found N records" |
| Records `DataTable` | 3 | dashboards/D13 | dense scanning (decision 1: records use DataTable, `RecordCard` grid dropped); sortable columns; row actions (edit/delete inline icons — decision 2) |
| Record edit modal | overlay | dashboards/D13 | `Modal` + `Input` primitives |

Breakpoints: toolbar `flex-col sm:flex-row`; DataTable `overflow-x-auto` (no page-level horizontal overflow at 360px); edit modal `max-w-lg` (UIS-01, UIS-02).

## 5. Content

i18n keys (EN + ES parity — `features/i18n/messages/{en,es}.ts`): `records.title` (default "Batch Records"), `subtitle`, `viewAllBatches`, `backToBatches`, `homeAria`, `searchPlaceholder` ("Search across all fields…"), `refresh`, `foundCount` ("Found {n} matching record(s)"), `showingCount` ("Showing {n} record(s)"), `noRecords`, `noRecordsHint`, `noSearchResultsHint`, `editTitle` ("Edit Record"), `deleteConfirmTitle`/`deleteConfirmBody`, `renderStatus.{active,waiting,delayed,completed,failed}`, `failedRetry` (if approved).

Copy rules: render-status badges icon + label (never color-only — UIS-04); edit modal labels via `Input` primitive; delete confirm explains permanence.

## 6. Interactions

- Search: `SearchBar` debounced 300ms (replaces `RecordSearch`'s own debounce — single implementation).
- Edit: row action opens `RecordEditModal` (migrate from its hand-rolled overlay to `Modal` primitive: focus trap, Esc, scroll lock; fields via `Input` primitive). Save → API → `refetch()` + close.
- Delete: `Modal` confirm (focus trap, Esc) → `deleteRecordAsync` → close + list refresh.
- **Failed render retry** (decision 3): row action on `failed` status → confirm → re-trigger render.
- Refresh → `refetch()` in place.
- Sortable columns (name/email/phone/status) via `DataTable` sort.
- Keyboard: table headers focusable when sortable; modal focus trap; `aria-label` on icon row actions.

## 7. Data dependencies

- `useRecords` + `useRecordDelete` hooks, `ContactRecord`/`RecordUpdateInput` types — `.work/features/from-claude/batch-records/`
- Render status API — batch-records / render-worker feature SPECs (`.work/features/` links; no contract duplication)
- Demo mode: same hooks via demo adapters (`.work/features/demo-local-persistence/20260716-SPEC.md`)

## 8. Tokens & components

Tokens: `--surface-*`, `--elevation-shadow-*`, `--border-*`, `--status-*`, `--accent-*`, `--text-*` (foundation doc 02).

| Component | Catalog status | Waiver |
|-----------|----------------|--------|
| AppShell | done (S0) | — |
| DataTable | done (S0) | — |
| SearchBar | done (S0) | — |
| Badge (render status) | done (S0) | — |
| StatePanel | done (S0) | — |
| Button | done (S0) | — |
| Modal (edit + delete) | done (S0) | — |
| Input (edit fields) | done (S0) | — |

No waiver needed — all §8 components done. (Migrate `RecordEditModal`'s internal `InputField` + overlay to the primitives; `RenderStatusBadge` → `Badge`.)

## 9. Accessibility

WCAG AA (assumption — foundation UA1, to be measured). Render status icon+label (UIS-04); visible labels on search + edit fields; modal focus trap/Esc/scroll-lock; DataTable `caption`/`scope` headers; sort state announced (`aria-sort`); touch targets ≥44px; no horizontal page overflow at 360px (table scrolls internally).

## 10. Analytics

`records_view` · `record_searched` · `record_edited{field?}` · `record_deleted` · `record_retry_render` (if approved) · `refresh_clicked` (no PII — never log field values).

## 11. Acceptance criteria

- [ ] Header: batch name + `BatchStatusBadge`; home + back-to-batches nav; View All Batches `Button` → `/batches` (D2)
- [ ] Toolbar: `SearchBar` (300ms debounce, single impl) + Refresh `Button` (D13)
- [ ] Records presented in `DataTable` (sortable name/email/phone/status; `caption` + `scope` headers; `aria-sort` on active column) — `RecordCard` grid dropped (D13: table with status badges + row highlight)
- [ ] Row actions: inline edit/delete icon buttons (trailing column) with `aria-label`; delete + retry use `Modal` confirm
- [ ] Render status = `Badge` icon+label tones: active/waiting/delayed→info, completed→success, failed→error (D1: status legend not color-only)
- [ ] Empty state branches: no-search vs search-query hints (D13)
- [ ] Loading/error: `StatePanel` (loading spinner; error + Retry) — no bare "Loading records…" text (doc 01 principle 1)
- [ ] Failed render: row action retries render (decision 3) with confirm; success/error reflected in badge
- [ ] Edit: `Modal` (focus trap, Esc, scroll lock) + `Input` fields with labels/errors; save → refetch + close (UIS-05)
- [ ] Delete: `Modal` confirm → delete → list refresh; cancel keeps list
- [ ] EN + ES parity (§5); ≥44px targets; table scrolls internally at 360px
- [ ] Data flow: search resets nothing destructive; `refetch` keeps edit/delete consistency

## 12. Concept / UIS registry

| UIS | Applies | Reason | Status |
|-----|---------|--------|--------|
| UIS-01 | yes | new layout/scan path | pending |
| UIS-02 | yes | mobile toolbar stack + internal table scroll (public Demo) | pending |
| UIS-03 | no | minimal motion | N/A |
| UIS-04 | yes | render status not color-only | pending |
| UIS-05 | yes | edit modal form (fields, errors, focus) | pending |
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
| **beforeScreenshot** | `inputs/design-references/batch-records-before.png` (optional) |

### extractedRules (binding, subset for this screen)

- **D1** — Status with legend/icon, never color-only.
- **D2** — Soft card elevation; table with status badges + row highlight (DataTable row hover).
- **D13** — Search/table with per-row actions; empty state gives guidance; dense table for scanning.

### regionMap

| §4 region | example id |
|-----------|------------|
| App header | dashboards/D2 |
| Toolbar | dashboards/D13 |
| Results count | dashboards/D2 |
| Records DataTable | dashboards/D13 |
| Edit modal | dashboards/D13 |

### Figma / external (optional)

- (none)

## 14. Data visualization

**N/A** — no charts; render-status column uses badges, not charts.

---

## Decisions (owner, 2026-08-14)

1. **Records → DataTable** (dense, sortable; per batches-SPEC decision 2) — `RecordCard` grid dropped on this screen.
2. **Row actions: inline icon buttons** (edit/delete) in a trailing column — only 2 actions, no overflow menu.
3. **Failed-render retry: yes** — row action on `failed` status → confirm → re-trigger render.

## Next action

`@ui-screen-spec review - .work.ui/screens/batch-records/20260814-SCREEN-SPEC.md`
