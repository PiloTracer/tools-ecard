# tools-ecards (E-Cards) — Pattern inventory

**Doc:** UI foundation **03** · **Created:** 2026-08-14 · **Status:** Draft · **Needs:** nothing (survey-based; example ids bound below)

Craft tier **refined** — every interactive control on primary flows must use a catalog primitive (SURFACE-AND-CONTROL-CRAFT §3). Catalog maintained in `.work.ui/design-system/CATALOG.md` by `@ui-design-system`.

## Existing (in repo today)

| Pattern | Location | Reuse? |
|---------|----------|--------|
| Canvas designer 3-column chrome (256px toolbox / canvas / 320px property panel) | `front-cards/features/template-textile/components/TemplateDesigner.tsx:79-99` | yes (core surface) |
| Canvas top toolbar (save/open/export/layers/undo-redo) | `.../Canvas/CanvasControls.tsx` | yes |
| Fabric.js canvas + pan/zoom/grid/selection | `.../Canvas/DesignCanvas.tsx` | yes |
| Property panels (text/image/QR/shape/font/line-metadata) | `.../PropertyPanel/*.tsx` | yes |
| Toolbox (elements + vCard fields) | `.../Toolbox/{ElementToolbox,VCardFieldsSection}.tsx` | yes |
| Per-page top header (white, `shadow-sm`, `max-w-7xl`) | `app/dashboard/page.tsx:66-124`, `app/batches/page.tsx:14-53`, `app/batches/[batchId]/records/page.tsx:42-109`, `app/profile/page.tsx:49-79` | **refactor** → shared AppShell primitive (4 hand-copied copies) |
| Card grids (batch cards, record cards) | `features/batch-view/BatchList.tsx`, `features/batch-records/RecordsList.tsx` | refactor → `Card` primitive |
| Status badges | `BatchStatusBadge.tsx`, `RenderStatusBadge.tsx` | refactor → `Badge` primitive (semantic colors + icon, legend not color-only) |
| Hand-rolled fixed-overlay modals | SaveTemplateModal, OpenTemplateModal, FieldMappingModal, RecordEditModal, NameBatchModal | **refactor** → `Modal` primitive (overlay + scrim token + focus trap + Esc) |
| Upload dropzone (react-dropzone) | `features/batch-upload/FileUploadComponent.tsx` | yes (as dropzone primitive) |
| Stepper+unit input | `features/template-textile/components/common/NumericStringInput.tsx:5-40` | refactor → `Stepper`/`NumericInput` primitive |
| Pagination (20/page) | `features/batch-view/BatchList.tsx:16` | yes → `Pagination` primitive |
| Search with debounce (300ms) | `features/batch-records/RecordSearch.tsx:24-30` | yes → `SearchBar` primitive |
| Skeleton shimmer (loading) | `BatchList.tsx:35-48` | yes → `Skeleton` primitive |
| Error card + Retry | `BatchList.tsx:50-82` | refactor → `ErrorState` primitive (hostile-input principle) |
| "Loading…" Suspense fallbacks | `app/page.tsx:70`, `login/page.tsx:204`, `auth/callback:299`, records `:138` | refactor → shared `LoadingState` (no bare text) |
| Language switcher (EN/ES) | `features/i18n/LanguageSwitcher.tsx` | yes |
| Project selector + settings | `features/simple-projects/{ProjectSelector,ProjectSettings}.tsx` | yes |
| Quick actions (3 dashed cards) | `features/simple-quick-actions/QuickActions.tsx:83-142` | yes |
| Usage progress bars | `app/dashboard/page.tsx:211-240` | yes → `Progress` primitive |
| Demo mode banner (sticky orange) | `features/demo/DemoModeProvider.tsx:60-141` | yes (tokenize `#c45c26`) |
| Auth gate spinner | `features/auth/ProtectedRoute.tsx:44-72` | yes → shared `LoadingState` |

## Needed (net-new)

| Pattern | Tier | Priority | Screen(s) | Example id | Catalog primitive |
|---------|------|----------|-----------|------------|-------------------|
| Button (primary/secondary/ghost/danger) | primitive | P0 | all | dashboards/D2 | Button |
| Card | primitive | P0 | dashboard, batches, records | dashboards/D2 | Card |
| Badge (status, semantic + icon) | primitive | P0 | batches, records, dashboard | dashboards/D1 | Badge |
| Modal (overlay + focus trap + Esc) | primitive | P0 | import, designer save/open, records | dashboards/D13 | Modal |
| DataTable | primitive | P0 | batches, records (operational density) | dashboards/D13 | DataTable |
| Input / Textarea (inset surface) | primitive | P0 | import, mapping, settings | dashboards/D13 | Input |
| SearchBar (debounced) | primitive | P0 | batches, records | dashboards/D13 | SearchBar |
| LoadingState / ErrorState / EmptyState | primitive | P0 | all (hostile-first-click) | dashboards/D10 | Skeleton / EmptyState |
| AppShell (header + nav + content) | compound | P0 | all app pages | dashboards/D2 | AppShell |
| SectionHeader | primitive | P1 | dashboard, settings | dashboards/D13 | SectionHeader |
| Select (custom, native fallback) | primitive | P1 | filters, project selector | dashboards/D13 | Select |
| Pagination | primitive | P1 | batches, records | dashboards/D5 | Pagination |
| Toggle / SegmentedControl | primitive | P1 | settings, designer | mobile-controls/C1 | Toggle / SegmentedControl |
| RangeSlider (custom anatomy) | primitive | P1 | designer canvas settings | mobile-controls/C1 | RangeSlider |
| IconButton | primitive | P1 | headers, designer toolbar | dashboards/D8 | IconButton |
| Progress (usage bars) | primitive | P1 | dashboard | dashboards/D8 | Progress |

## Catalog

Detailed rows: `.work.ui/design-system/CATALOG.md` (currently an unfilled template — `@ui-design-system init` after `certify screen-spec-ready`).

## Migration backlog (foundation → S0)

1. Tokenize hardcoded hex (`DemoModeProvider`, landing gradients) + apply Geist font fix
2. Extract `AppShell` from the 4 per-page headers
3. Extract `Modal`, `Badge`, `Button`, `Card` primitives from existing hand-rolled code before new SPEC-driven work

## Next action

`@ui-design-foundation greenfield` — continue with foundation doc 04 (screen map)
