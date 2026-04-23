# Template Textile - Feature Architecture

## Overview
Template Textile is a modular canvas-based template editor for creating and exporting personalized business cards and graphics. It consists of three independent sub-features that work together.

**Note:** `api-server/src/features/template-designer/` exists in the tree but only holds re-export stubs pointing at non-local paths; the **real** API feature is **`api-server/src/features/template-textile`**. Ignore `template-designer` for routing and documentation unless it is cleaned up in code.

## Sub-Features

### 1. [Template Textile Core](./template-textile-core.md)
**Main canvas editor and template management**

**Scope**: Template CRUD, canvas rendering, element manipulation, single export
**Key Tech**: Fabric.js, Zustand, IndexedDB
**Entry Point**: `/template-textile`

### 2. [Template Fonts](./template-fonts.md)
**Font management system**

**Scope**: Font loading, upload, deletion, Google Fonts integration
**Key Tech**: Cassandra, SeaweedFS, @font-face CSS injection
**API**: `/api/v1/fonts`

### 3. [Template Batch](./template-batch.md)
**Batch export with data merge**

**Scope**: Batch record processing, vCard generation, ZIP creation
**Key Tech**: JSZip, vCard 3.0, pagination
**API**: `/api/batches/:batchId/records`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Template Textile                          │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Template Textile Core (Main)                  │  │
│  │  • Canvas editing • Templates • Single export         │  │
│  └───────────┬──────────────────────────┬────────────────┘  │
│              │                          │                    │
│              │ Uses fonts               │ Triggers batch     │
│              │                          │                    │
│  ┌───────────▼──────────┐   ┌───────────▼────────────────┐  │
│  │  Template Fonts      │   │    Template Batch          │  │
│  │  (Subsystem)         │   │    (Subsystem)             │  │
│  │  • Font loading      │   │    • Batch records         │  │
│  │  • Font upload       │   │    • Data merge            │  │
│  │  • Font selection    │   │    • vCard generation      │  │
│  │  • Google Fonts      │   │    • ZIP export            │  │
│  └──────────────────────┘   └────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                      Shared Infrastructure
          ┌────────────────────────────────────────┐
          │         Export Service                  │
          │  • Offscreen canvas                    │
          │  • Image export (PNG/JPG)              │
          │  • Safe area fitting                   │
          │  • High-res image replacement          │
          └────────────────────────────────────────┘
```

## Data Flow

### Single Template Export
```
User → Template Core → Export Service → PNG/JPG Download
                ↓
         Font Loading (Template Fonts)
```

### Batch Export
```
User → Template Core → Batch Export Modal
                         ↓
              Template Batch Service
                ↓                ↓
         Fetch Records    Apply Data (field mapping)
                ↓                ↓
         Generate vCard   Export Service (for each record)
                ↓
         Create ZIP → Download
```

### Font Management
```
User → Font Selector (Template Fonts) → Font Service
         ↓                                    ↓
    Browse/Search                      Load font (@font-face)
         ↓                                    ↓
    Upload Font                         Cassandra + SeaweedFS
```

## Current File Structure

```
front-cards/features/template-textile/
├── components/
│   ├── Canvas/                        [CORE]
│   ├── PropertyPanel/
│   │   ├── FontSelector.tsx          [FONTS - Move to fonts/]
│   │   └── ...                       [CORE]
│   ├── Toolbar/                      [CORE]
│   ├── SaveModal/                    [CORE]
│   ├── OpenModal/                    [CORE]
│   ├── TemplateStatus/               [CORE]
│   └── OffscreenExport/              [CORE + BATCH - Split?]
├── services/
│   ├── templateService.ts            [CORE]
│   ├── canvasRenderer.ts             [CORE]
│   ├── exportService.ts              [SHARED - Used by Core + Batch]
│   ├── fontService.ts                [FONTS - Move to fonts/]
│   ├── batchExportService.ts         [BATCH - Move to batch/]
│   ├── vcardGenerator.ts             [BATCH - Move to batch/]
│   ├── resourceManager.ts            [CORE]
│   └── browserStorageService.ts      [CORE]
├── stores/
│   ├── canvasStore.ts                [CORE]
│   └── templateStore.ts              [CORE]
├── utils/
│   ├── imageHighResReplacer.ts       [CORE]
│   ├── multiColorText.ts             [CORE]
│   └── vcardFields.ts                [BATCH - Move to batch/]
└── types/
    └── index.ts                      [CORE]

api-server/src/features/
├── font-management/                  [FONTS - Already separated]
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   └── types/
└── batch-view/                       [BATCH - Backend already exists]
    ├── controllers/
    ├── services/
    └── routes/
```

## Proposed File Structure (After Migration)

```
features/
├── template-textile/                 [CORE ONLY]
│   ├── components/
│   │   ├── Canvas/
│   │   ├── PropertyPanel/           (without FontSelector)
│   │   ├── Toolbar/
│   │   ├── SaveModal/
│   │   ├── OpenModal/
│   │   ├── TemplateStatus/
│   │   └── ExportButton/            (single export only)
│   ├── services/
│   │   ├── templateService.ts
│   │   ├── canvasRenderer.ts
│   │   ├── exportService.ts         (shared)
│   │   ├── resourceManager.ts
│   │   └── browserStorageService.ts
│   ├── stores/
│   │   ├── canvasStore.ts
│   │   └── templateStore.ts
│   ├── utils/
│   │   ├── imageHighResReplacer.ts
│   │   └── multiColorText.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts                     (public API)
│
├── template-fonts/                   [FONTS SUBSYSTEM]
│   ├── components/
│   │   └── FontSelector.tsx
│   ├── services/
│   │   └── fontService.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts                     (public API)
│
└── template-batch/                   [BATCH SUBSYSTEM]
    ├── components/
    │   └── BatchExportModal.tsx
    ├── services/
    │   ├── batchExportService.ts
    │   └── vcardGenerator.ts
    ├── utils/
    │   └── vcardFields.ts
    ├── types/
    │   └── index.ts
    └── index.ts                     (public API)
```

## Migration Checklist

### Phase 1: Extract Fonts (Low Risk)
- [ ] Create `features/template-fonts/` directory
- [ ] Move `services/fontService.ts`
- [ ] Move `components/PropertyPanel/FontSelector.tsx`
- [ ] Create `features/template-fonts/index.ts` (public API)
- [ ] Update imports in template-textile-core
- [ ] Test font upload/selection
- [ ] Update context files

### Phase 2: Extract Batch (Low Risk)
- [ ] Create `features/template-batch/` directory
- [ ] Move `services/batchExportService.ts`
- [ ] Move `services/vcardGenerator.ts`
- [ ] Move `utils/vcardFields.ts`
- [ ] Split `OffscreenExportButton` or keep as trigger in core
- [ ] Create `features/template-batch/index.ts` (public API)
- [ ] Update imports in template-textile-core
- [ ] Test batch export flow
- [ ] Update context files

### Phase 3: Clean Up Core (Refactoring)
- [ ] Remove moved files from template-textile
- [ ] Update all imports to use new paths
- [ ] Update `features/template-textile/index.ts`
- [ ] Verify all features work together
- [ ] Update documentation

## Benefits of Modular Architecture

### Development
✅ Smaller, focused context windows for AI assistance
✅ Clear separation of concerns
✅ Independent testing and debugging
✅ Parallel development on different sub-features

### Maintenance
✅ Easier to understand each subsystem
✅ Changes isolated to relevant sub-feature
✅ Reduced risk of breaking unrelated functionality

### Reusability
✅ Font management can be used in other editors
✅ Batch export can process any template structure
✅ Export service is shared infrastructure

### Scalability
✅ Can add new sub-features (e.g., template-shapes, template-animations)
✅ Can extract more subsystems as needed
✅ Clear API boundaries between features

## Integration Points

### Template Core → Fonts
```typescript
import { fontService, FontSelector } from '@/features/template-fonts';
```

### Template Core → Batch
```typescript
import { exportTemplateToBatch } from '@/features/template-batch';
```

### Template Fonts ← Backend
```
GET /api/v1/fonts
POST /api/v1/fonts
DELETE /api/v1/fonts/:id
```

### Template Batch ← Backend
```
GET /api/batches/:batchId/records
```

## Shared Dependencies

### All Sub-Features Use
- `fabric.js` - Canvas rendering
- `@/shared/lib/api-client` - API communication
- React, TypeScript, Next.js

### Export Service (Shared Infrastructure)
Used by both Template Core and Template Batch
- Offscreen canvas creation
- Element rendering
- Safe area fitting (30px padding)
- Image export (PNG/JPG)
- Background color handling

## Notes
- Backend features are already well-separated (font-management, batch-view)
- Frontend needs refactoring to match backend structure
- Shared services (exportService) should remain in core or move to shared lib
- Migration can be done incrementally (fonts first, then batch)
