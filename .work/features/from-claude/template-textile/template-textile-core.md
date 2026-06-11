# Template Textile - Core Feature

## Purpose
Core canvas-based template editor functionality. Handles template creation, editing, rendering, and single-template export operations.

## Scope
- Canvas rendering and interaction
- Template CRUD operations
- Element manipulation (text, images, QR codes, shapes)
- Property panels and controls
- Single template export (PNG, JPG, SVG, JSON)
- Template state management
- Undo/redo functionality

## Key Files

### Components
- `components/Canvas/Canvas.tsx` - Main fabric.js canvas component
- `components/Canvas/CanvasControls.tsx` - Zoom, grid, background, export controls
- `components/PropertyPanel/` - Element property editors
- `components/Toolbar/` - Element creation toolbar
- `components/SaveModal/SaveTemplateModal.tsx` - Save template dialog
- `components/OpenModal/OpenTemplateModal.tsx` - Load template dialog
- `components/TemplateStatus/TemplateStatus.tsx` - Template status indicator
- `components/OffscreenExport/OffscreenExportButton.tsx` - Export dialog (single + batch; shares export base width with Canvas Settings when the same template is open)
- `components/CanvasSettings/CanvasSettings.tsx` - Preset and custom **canvas** size, **export base width** (px / cm / in for display; stored as px on `Template` and in `templateStore`)
- `utils/lengthUnits.ts` - CSS 96px-per-inch mapping for `px` / `cm` / `in` in the UI; Fabric and `exportService` only see pixels

### Services
- `services/templateService.ts` - Template CRUD and storage
- `services/canvasRenderer.ts` - Render template elements to fabric.js canvas
- `services/exportService.ts` - Export templates to images (PNG/JPG/SVG)
- `services/resourceManager.ts` - Manage template resources (images, etc.)
- `services/browserStorageService.ts` - IndexedDB storage for templates

### Utilities
- `utils/imageHighResReplacer.ts` - Replace images with high-res versions for export
- `utils/multiColorText.ts` - Multi-color text rendering utilities
- `utils/vcardFields.ts` - vCard field definitions and mappings

### Stores (Zustand)
- `stores/canvasStore.ts` - Canvas state (zoom, grid, background color)
- `stores/templateStore.ts` - Template state, elements, undo/redo

### Types
- `types/index.ts` - Core template types (Template, TemplateElement, TextElement, etc.)

## Dependencies

### Internal Dependencies
- **template-fonts** - Uses font loading and management
- **template-batch** - Batch export triggered from OffscreenExportButton

### External Dependencies
- `fabric.js` - Canvas rendering library
- `zustand` - State management
- `@/shared/lib/api-client` - API communication

## Key Concepts

### Template Structure
```typescript
interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  elements: TemplateElement[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Export Flow
1. Load template from storage
2. Create offscreen canvas
3. Add background rectangle (for solid backgrounds)
4. Recreate all elements on canvas
5. Fit text to safe area (30px padding)
6. Replace with high-res images
7. Remove excluded objects
8. Render and export to data URL

### Export dimensions and units (single, batch, quick PNG/JPG)
- **Canvas** size in the editor is always stored in **pixels** on the `Template` (`width` / `height`). The **Canvas Settings** panel uses **one** unit control (px / cm / in) for **canvas width/height, export base width, and the export modal** (no second unit dropdown on export base). Values are converted using **96px = 1in** (CSS). Preset buttons still apply pixel dimensions and switch the unit to px.
- **Export base width** is one number in **pixels** on the model (`template.exportWidth` and `templateStore.exportWidth`). The same global unit is used to display and edit that width everywhere.
- **Offscreen / batch export** (`OffscreenExportButton`) and **in-canvas** PNG/JPG/SVG use the same `exportWidth` when the user is editing that template in the app (Zustand store stays in sync). If a template is exported without a prior saved `exportWidth`, the modal and store default to a sensible base (e.g. 1920px) and the user can change size in the export modal (numeric field, unit selector, or range slider) before running single or **batch** export. Final `width×height` in **pixels** is always shown before download.
- Optional on `Template`: `canvasSizeUnit` and `exportBaseWidthUnit` record the last display units in the editor for reload consistency.

### Safe Area
- 30px padding on all sides
- Text objects scaled uniformly if they exceed safe area
- Minimum scale: 50% (0.5)
- Maintains aspect ratio and readability

## API Surface

### Public Functions (exported)
- `exportTemplateById(templateId, options)` - Export template by ID
- `exportTemplate(template, options)` - Export template object
- `downloadDataUrl(dataUrl, filename)` - Download image from data URL

### Template Service API
- `saveTemplate(template)` - Save template to storage
- `loadTemplate(templateId)` - Load template from storage
- `deleteTemplate(templateId)` - Delete template
- `listTemplates()` - List all templates

## Notes
- This is the CORE feature that other sub-features depend on
- Font management and batch export are separate concerns
- Export service is shared infrastructure used by both core and batch
