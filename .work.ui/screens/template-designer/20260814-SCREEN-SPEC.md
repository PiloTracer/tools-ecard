# Template Designer — Screen SPEC

**Status:** Approved  
**Needs:** nothing — owner-approved 2026-08-14 (decisions below)  
**Slug:** template-designer  
**Path:** `.work.ui/screens/template-designer/20260814-SCREEN-SPEC.md`

---

## 1. Summary

The template designer (`/template-textile`) is the core creative surface: a full-screen Fabric.js canvas where operators compose card templates — text, images, QR codes, shapes, and draggable vCard fields — with precise property controls, save/open/import, and export (PNG/JPG/SVG/ZIP+JSON). It is a **power-user tool**: dense, keyboard-driven, role-aware (global templates gated by `app_roles`), and Demo-persistent. Entry: dashboard **Quick Actions → Template Designer**. Guarded by `ProtectedRoute`; an untitled 1076×380 template is auto-created on entry.

## 2. Personas & jobs

| Persona | Job |
|---------|-----|
| Template creator | Compose a card visually, map vCard fields, style text/images/QR, save privately (or globally when `appsuper`/`appglobal`), export artifacts |
| Batch operator | Open a template, tweak fields/layout, save a fork, export PNG/ZIP for a batch |
| Demo visitor | Try the designer end-to-end with browser-only persistence (render mocked) |

## 3. States

| State | Behaviour |
|-------|-----------|
| loading | `ProtectedRoute` spinner; canvas `isReady` gating; Open-modal spinner; font preload before template load |
| empty | Auto-created untitled template (1076×380); `TemplateStatus` shows "Unsaved template" |
| unsaved | Dirty indicator + "Saved X ago" (`templateStore.markAsChanged`); **Ctrl+S** quick-save; Close/Back confirm (Close = custom modal; dashboard Back = `window.confirm` → migrate to Modal); **add `beforeunload` guard** (missing today — open Q2) |
| error | Save: inline error in `SaveTemplateModal`; Export: `alert()` on canvas taint + ZIP failure → migrate to inline `StatePanel`/`Modal` errors (open Q3); Delete confirm |
| success | "Saved X ago" after save; save spinner while persisting; export progress bar (steps: fonts→canvas→elements; batch current/total) |
| permission | Global save/delete affordances visible only for `appsuper`/`appglobal`; **hidden in demo** (D13 hide-don't-disable); server enforces `isPublic` |
| partial | Storage mode `FALLBACK` (online/offline re-detection) — badge in status row |

## 4. Layout & hierarchy

Full-screen 3-column shell (`flex h-screen w-full flex-col`) — this screen does **not** use `AppShell` (immersive chrome):

| Region | Priority | Example id | Notes |
|--------|----------|------------|-------|
| CanvasSettings top bar (title, units, aspect presets) | 0 | dashboards/D2 | stacks on mobile (`sm:`) |
| CanvasControls row 1 — file actions (status, Save, Open, Import, Close, Delete, Batch Export) | 1 | dashboards/D2 | amber Save when dirty |
| CanvasControls row 2 — view/export (zoom ±/1:1, Undo/Redo, Elements/Layers, Grid/Snap toggles, BG color, PNG/JPG/SVG/ZIP) | 1 | dashboards/D2 | `overflow-x-auto` on mobile |
| Toolbox (left, `w-64`): Elements (Text/Image/QR) + Shapes grid + collapsible VCARD FIELDS groups | 2 | dashboards/D2 | not scrollable today — make `overflow-y-auto` |
| DesignCanvas (center, `flex-1`): pan/zoom/grid/snap, Space+drag, Alt+click cycle | 2 | dashboards/D2 | |
| PropertyPanel (right, `w-80`): position/size/rotation, layering, align, type-specific panels, lock/no-output, multi-select banner | 3 | mobile-controls/C1 | controls cluster (steppers, toggles, sliders) |
| Modals: SaveTemplate, OpenTemplate, Elements/Layers, Close-confirm, Delete-confirm | overlay | dashboards/D13 | all → `Modal` primitive |

**Mobile (decisions 1–3):** toolbox + property panel become **slide-in drawers** on narrow viewports (canvas keeps focus); `beforeunload` guard added when dirty; all `window.confirm`/`alert()` migrated to `Modal`/`StatePanel` in S4.

## 5. Content

i18n keys (EN + ES parity — `features/i18n/messages/{en,es}.ts`): existing `designer.*` (backToDashboard, unsavedChanges, appTitle, appSubtitle, untitledTemplate) + new: `designer.save/open/import/close/delete/batchExport`, `zoomIn/zoomOut/zoomReset`, `undo/redo`, `elements/layers`, `grid/snap`, `background`, `exportPng/exportJpg/exportSvg/exportZip/exportJson`, `saveAsCopy`, `untitledTemplate`, `savedAgo` ("Saved {time} ago"), `saving`, `unsavedChanges`, `confirmCloseTitle/Body`, `confirmDeleteTemplateTitle/Body`, `canvasTaintError`, `exportFailed`, property panel section headers, vCard field group labels (Core Contact / Business / Personal).

Copy rules: no `window.confirm`/`alert()` strings (migrate to Modal/StatePanel); errors state what happened + next action; role-gated global labels ("Global template") localized.

## 6. Interactions

- **Keyboard (keep — core power-user contract):** Ctrl/Cmd+S save · Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo/redo · Ctrl+D duplicate · Ctrl+C/V copy-paste (+20px offset) · Delete/Backspace delete · Esc deselect · Tab/Shift+Tab cycle selectable objects.
- Canvas: Space+drag pan (grab/grabbing cursor, Panning Mode badge) · Alt+click cycles overlapping objects · zoom via toolbar (0.1–5, 1:1 reset) · drag-drop vCard fields onto canvas (drop coords ÷ zoom, clamped).
- Fork semantics (keep): opening a template then saving creates **a new design** (`resolveSaveIntent`); Open loads by id → `loadTemplate` (font preload) → fork source set.
- Save: Ctrl+S with unnamed template opens `SaveTemplateModal`; name/project inputs; "`<name> copy`" suggestion when opened from a template.
- Export: viewport reset → strip grid/`excludeFromExport` → high-res swap (SVG×5) → `toDataURL` at export multiplier → restore; ZIP = package export (PNG preview + JSON sidecar); export progress surfaced inline.
- Global templates: save with `global` only when `canManageGlobalTemplates`; **hidden** (not disabled) in demo (D13).
- New: `beforeunload` guard when dirty (decision 2); all confirms/errors via `Modal`/`StatePanel` — no `window.confirm`/`alert()` (decision 3).

## 7. Data dependencies

- `features/template-textile/` — `.work/features/from-claude/template-textile/` (designer SPEC link): `templateStore`/`canvasStore` (Zustand, history cap 50), `exportService` (`exportTemplate` steps, `batchExportTemplates`), `templateService` (demo/normal repositories), `templateSaveIntent`, `rasterizeImages`, `FontSelector` (font API), `appRoles` (global gate)
- Render: `.work/features/from-claude/render-worker/` (batch PNG)
- Demo: `.work/features/demo-local-persistence/20260716-SPEC.md` (localStorage+IndexedDB, render mocked)

## 8. Tokens & components

Tokens: `--surface-*`, `--elevation-shadow-*`, `--border-*`, `--status-*`, `--accent-*`, `--text-*` (foundation doc 02).

| Component | Catalog status | Waiver |
|-----------|----------------|--------|
| Button | done (S0) | — |
| Modal (save/open/layers/close/delete) | done (S0) | — |
| Input / Select / Badge / StatePanel | done (S0) | — |
| IconButton (toolbar) | **planned (S4)** | native buttons allowed until built |
| Toggle (grid/snap/lock/no-output) | **planned (S4)** | native checkbox/button allowed until built |
| RangeSlider (opacity/zoom) | **planned (S4)** | native range + ds styles allowed until built (mobile-controls/C1 cited → custom anatomy in S4) |
| NumericInput/Stepper | existing (`NumericStringInput`) | keep; map to catalog when `Stepper` built (S4+) |

## 9. Accessibility

WCAG AA (assumption — foundation UA1, to be measured). - Keyboard-first design already strong — keep the full keymap (§6) and document it; toolbar icon buttons `aria-label` (CanvasControls already does for most); modals (Modal primitive: focus trap/Esc/scroll-lock); canvas is a rich interactive surface — provide a text alternative/table fallback per canvas region is out of scope (note: `excludeFromExport` + field names give the underlying data); color pickers keyboard-operable; grid/snap toggles exposed as buttons with `aria-pressed`; **no `alert()` for errors** (StatePanel with focus move — decision 3); `beforeunload` message is browser-controlled (decision 2); drawers keyboard-openable/closeable (Esc, focus return) on mobile.

## 10. Analytics

`designer_view` · `element_added{type}` · `vcard_field_added{field}` · `template_saved{global:boolean}` · `template_opened` · `template_deleted` · `export{format}` · `undo/redo` · `zoom{level}` (no PII — never log field values).

## 11. Acceptance criteria

- [ ] All chrome uses tokens (no raw hex/`shadow-md` in touched files; token-lint 0 literals) (D2: soft card elevation, toolbar wells)
- [ ] Keyboard map §6 fully preserved and tested (Ctrl+S/Z/Y/D/C/V, Delete, Esc, Tab cycle) (D2/D13)
- [ ] Toolbar actions: Save (amber when dirty + spinner), Open, Import, Close, Delete, Batch Export, zoom ±/1:1, Undo/Redo, Layers, Grid/Snap, BG color, PNG/JPG/SVG/ZIP exports
- [ ] Fork-on-save semantics preserved (`resolveSaveIntent`); Open → `loadTemplate` (font preload) → fork source
- [ ] Global templates: affordances visible only for `appsuper`/`appglobal`, **hidden in demo** (D13 hide-don't-disable); server `isPublic` enforcement untouched
- [ ] Property panels: position/size/rotation (unit-aware), layering, align, lock, no-output, per-type controls (text/image/QR/shape), line metadata — all via token-bound controls (C1 controls with waiver)
- [ ] Modals: SaveTemplate/OpenTemplate/Layers/Close/Delete → `Modal` primitive (focus trap, Esc); **no `window.confirm`/`alert()`** (migrated — decision 3); beforeunload guard added when dirty (decision 2)
- [ ] Toolbox scrollable on short viewports (`overflow-y-auto`); toolbar row 2 horizontal-scrolls on mobile; **toolbox + property panel become slide-in drawers on narrow viewports** (decision 1; Esc closes, focus returns, canvas keeps focus)
- [ ] Export: viewport-reset + exclude-from-export + high-res swap preserved; progress surfaced inline (no silent failure)
- [ ] **`beforeunload` guard** shown when dirty (decision 2); no `window.confirm`/`alert()` remain in the designer (decision 3) — all via `Modal`/`StatePanel`
- [ ] Demo parity: same flows via `demoTemplateRepository`; storage-mode badge
- [ ] EN + ES parity (§5); ≥44px touch targets; token-lint/eslint/tsc/jest green

## 12. Concept / UIS registry

| UIS | Applies | Reason | Status |
|-----|---------|--------|--------|
| UIS-01 | yes | complex layout/scan path | pending |
| UIS-02 | yes | mobile panels/canvas (public Demo) | pending |
| UIS-03 | no | minimal motion — canvas panning is interaction, not decoration | N/A |
| UIS-04 | yes | status/badges not color-only | pending |
| UIS-05 | yes | property-panel forms (labels, errors, focus) | pending |
| UIS-06 | yes | agent build | pending |
| UIS-07 | yes | craft tier refined | pending |
| UIS-08 | yes | all screens before ship | pending |
| UIS-09 | no | not analytical | N/A |
| UIS-10 | no | no marketing hero | N/A |

## 13. Visual references

| Field | Value |
|-------|-------|
| **exampleIds** | `dashboards/D2`, `mobile-controls/C1`, `dashboards/D13` |
| **manifestPaths** | `.ai.ui/examples/dashboards/manifest.md`, `.ai.ui/examples/mobile-controls/manifest.md` |
| **craftTier** | refined |
| **beforeScreenshot** | `inputs/design-references/template-designer-before.png` (optional) |

### extractedRules (binding, subset for this screen)

- **D2** — Toolbar wells + elevated chrome on light background; active-state affordances for grid/snap/lock.
- **C1** — Custom control anatomy for opacity/zoom sliders (track/thumb token-backed, value readout) — **waiver: native range + ds styles until `RangeSlider` built in S4**; toggles with visible state.
- **D13** — Role-based visibility: global-template actions **hidden, not disabled**; empty/loading states give guidance.

### regionMap

| §4 region | example id |
|-----------|------------|
| CanvasSettings top bar | dashboards/D2 |
| Toolbar rows | dashboards/D2 |
| Toolbox | dashboards/D2 |
| DesignCanvas | dashboards/D2 |
| PropertyPanel | mobile-controls/C1 |
| Modals | dashboards/D13 |

### Figma / external (optional)

- (none)

## 14. Data visualization

**N/A** — no charts; canvas is a design surface, not data viz.

---

## Decisions (owner, 2026-08-14)

1. **Mobile: slide-in drawers** — toolbox + property panel become drawers on narrow viewports (Esc closes, focus returns, canvas keeps focus).
2. **`beforeunload` guard** added when the template is dirty (browser-controlled message).
3. **`window.confirm`/`alert()` migration** — all confirms and errors move to `Modal`/`StatePanel` in S4 (dashboard Back confirm, canvas-taint export alert, ZIP-failure alert).

## Next action

`@ui-screen-spec review - .work.ui/screens/template-designer/20260814-SCREEN-SPEC.md`
