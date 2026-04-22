# Template-Textile: Off-Screen Export Implementation Plan

**Created:** 2025-11-26
**Status:** Ready for Implementation
**Estimated Effort:** 2-3 hours
**Priority:** Medium
**Dependencies:** None (standalone feature)

## Objective

Enable exporting templates to PNG/JPG **without requiring the template to be open** in the canvas editor. Export process will:

1. Load template JSON from storage
2. Create off-screen Fabric.js canvas
3. Recreate all elements programmatically
4. Export at configured resolution
5. Clean up resources

This enables:
- ✅ Export templates without opening them
- ✅ Batch export multiple templates
- ✅ Background export jobs
- ✅ Future integration with batch generation system

## Current State Analysis

### What We Have ✅

1. **Element Recreation Logic** (`DesignCanvas.tsx:369-608`)
   - Complete switch statement for creating Fabric objects from JSON
   - Handles all element types: text, image, shape, qr
   - Image loading with blob URL conversion
   - Multi-color text support

2. **Export Logic** (`CanvasControls.tsx:287-463`)
   - High-resolution image replacement (5x multiplier)
   - PNG/JPG export with quality settings
   - Viewport reset and cleanup

3. **Template Storage** (`templateService.ts`)
   - Load template by ID
   - All data stored in JSON (images as data URLs)

### What We Need ❌

1. **Reusable Element Recreation Function**
   - Extract from DesignCanvas.tsx
   - Make independent of component lifecycle
   - Return Promise for async operations

2. **Off-Screen Canvas Creation**
   - Create invisible canvas element
   - Configure Fabric.js settings
   - Proper disposal after export

3. **Export Service**
   - Orchestrate: Load → Create → Recreate → Export → Clean
   - Handle errors gracefully
   - Progress callbacks for batch operations

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  User Request: Export Template                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  exportService.exportTemplateById(id, options)         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ├─→ 1. Load template JSON
                 │    templateService.loadTemplate(id)
                 │
                 ├─→ 2. Create off-screen canvas
                 │    createOffscreenCanvas(width, height)
                 │
                 ├─→ 3. Recreate elements
                 │    canvasRenderer.recreateElements(canvas, elements)
                 │
                 ├─→ 4. Export at resolution
                 │    canvas.toDataURL({ multiplier, format })
                 │
                 └─→ 5. Clean up
                      canvas.dispose()
                      URL.revokeObjectURL(blobUrls)
```

## Implementation Plan

### Phase 1: Extract Element Recreation Logic

**Estimated:** 30 minutes

#### Step 1.1: Create `canvasRenderer.ts` Service

**File:** `front-cards/features/template-textile/services/canvasRenderer.ts`

**Purpose:** Reusable element-to-Fabric-object conversion

**Exports:**
```typescript
export interface CanvasRendererOptions {
  loadImages?: boolean;           // Default: true
  onProgress?: (current: number, total: number) => void;
}

export async function recreateElements(
  canvas: fabric.Canvas,
  elements: TemplateElement[],
  options?: CanvasRendererOptions
): Promise<void>;

// Helper functions (private)
async function createElement(element: TemplateElement): Promise<fabric.Object>;
async function createTextElement(el: TextElement): Promise<fabric.Object>;
async function createImageElement(el: ImageElement): Promise<fabric.Object>;
async function createShapeElement(el: ShapeElement): Promise<fabric.Object>;
async function createQRElement(el: QRElement): Promise<fabric.Object>;
```

**What to Extract from DesignCanvas.tsx:**
- Lines 369-608: Main element recreation loop
- Lines 1088-1284: Text element creation
- Lines 1288-1387: Image element creation (with blob URL logic)
- Lines 1389-1408: Shape placeholder creation
- Lines 1412-1519: QR element creation

**Key Changes:**
- Remove React dependencies (`useRef`, `useState`)
- Make all functions async
- Return Promises for image loading
- Add progress callbacks
- Keep blob URL cleanup logic

**Code Structure:**
```typescript
export async function recreateElements(
  canvas: fabric.Canvas,
  elements: TemplateElement[],
  options: CanvasRendererOptions = {}
): Promise<void> {
  const { loadImages = true, onProgress } = options;
  const blobUrls: string[] = [];

  try {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Progress callback
      onProgress?.(i + 1, elements.length);

      // Create Fabric object
      const fabricObject = await createElement(element, loadImages, blobUrls);

      if (fabricObject) {
        canvas.add(fabricObject);
      }
    }

    canvas.renderAll();
  } catch (error) {
    // Clean up blob URLs on error
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }

  // Return blob URLs for caller to clean up
  return blobUrls;
}
```

#### Step 1.2: Update DesignCanvas.tsx to Use New Service

**File:** `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx`

**Changes:**
```typescript
import { recreateElements } from '../services/canvasRenderer';

// Replace lines 369-608 with:
useEffect(() => {
  if (!fabricCanvas || elements.length === 0) return;

  recreateElements(fabricCanvas, elements, {
    loadImages: true,
    onProgress: (current, total) => {
      // Optional: show loading indicator
    }
  }).catch(error => {
    console.error('Failed to recreate elements:', error);
  });
}, [elements, fabricCanvas]);
```

**Benefits:**
- ✅ Cleaner DesignCanvas component
- ✅ Reusable logic for off-screen export
- ✅ Easier to test independently

---

### Phase 2: Create Export Service

**Estimated:** 45 minutes

#### Step 2.1: Create `exportService.ts`

**File:** `front-cards/features/template-textile/services/exportService.ts`

**Purpose:** Orchestrate off-screen canvas creation and export

**Exports:**
```typescript
export interface ExportOptions {
  format: 'png' | 'jpg';
  quality?: number;              // 0-1, for JPG
  width?: number;                // Override export width
  height?: number;               // Override export height, maintains aspect ratio
  backgroundColor?: string;      // Canvas background
  onProgress?: (step: string, progress: number) => void;
}

export interface ExportResult {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export async function exportTemplateById(
  templateId: string,
  options: ExportOptions
): Promise<ExportResult>;

export async function exportTemplate(
  template: Template,
  options: ExportOptions
): Promise<ExportResult>;

export async function batchExportTemplates(
  templateIds: string[],
  options: ExportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ExportResult>>;
```

**Implementation:**

```typescript
import { fabric } from 'fabric';
import { templateService } from './templateService';
import { recreateElements } from './canvasRenderer';
import type { Template, TemplateElement } from '../types';

export async function exportTemplateById(
  templateId: string,
  options: ExportOptions
): Promise<ExportResult> {
  // Step 1: Load template
  options.onProgress?.('Loading template', 0.1);
  const loaded = await templateService.loadTemplate(templateId);

  // Step 2: Export using loaded template
  return exportTemplate(loaded.data, options);
}

export async function exportTemplate(
  template: Template,
  options: ExportOptions
): Promise<ExportResult> {
  const {
    format,
    quality = 1.0,
    width,
    height,
    backgroundColor,
    onProgress
  } = options;

  // Calculate dimensions
  const canvasWidth = template.width || template.canvasWidth || 1200;
  const canvasHeight = template.height || template.canvasHeight || 600;

  const exportWidth = width || template.exportWidth || canvasWidth;
  const exportHeight = height || (exportWidth * canvasHeight / canvasWidth);
  const multiplier = exportWidth / canvasWidth;

  // Step 1: Create off-screen canvas
  onProgress?.('Creating canvas', 0.2);
  const offscreenCanvas = createOffscreenCanvas(canvasWidth, canvasHeight, backgroundColor);

  try {
    // Step 2: Recreate elements
    onProgress?.('Recreating elements', 0.3);
    const blobUrls = await recreateElements(
      offscreenCanvas,
      template.elements || [],
      {
        loadImages: true,
        onProgress: (current, total) => {
          const progress = 0.3 + (0.5 * (current / total));
          onProgress?.('Loading images', progress);
        }
      }
    );

    // Step 3: Replace images with high-res versions (same as CanvasControls.tsx)
    onProgress?.('Preparing high-resolution images', 0.8);
    await replaceImagesWithHighRes(offscreenCanvas, template.elements || []);

    // Step 4: Export
    onProgress?.('Exporting', 0.9);
    const dataUrl = offscreenCanvas.toDataURL({
      format: format,
      quality: format === 'jpg' ? quality : 1.0,
      multiplier: multiplier
    });

    // Clean up blob URLs
    blobUrls?.forEach(url => URL.revokeObjectURL(url));

    onProgress?.('Complete', 1.0);

    return {
      dataUrl,
      width: exportWidth,
      height: exportHeight,
      format,
      sizeBytes: dataUrl.length
    };
  } finally {
    // Always clean up canvas
    offscreenCanvas.dispose();
  }
}

function createOffscreenCanvas(
  width: number,
  height: number,
  backgroundColor?: string
): fabric.Canvas {
  // Create invisible canvas element
  const canvasElement = document.createElement('canvas');
  canvasElement.width = width;
  canvasElement.height = height;
  canvasElement.style.position = 'absolute';
  canvasElement.style.left = '-9999px';
  canvasElement.style.top = '-9999px';

  // Append to body (required for Fabric.js to work)
  document.body.appendChild(canvasElement);

  // Create Fabric canvas
  const fabricCanvas = new fabric.Canvas(canvasElement, {
    width,
    height,
    backgroundColor: backgroundColor || '#ffffff',
    renderOnAddRemove: false, // Performance: manual render control
    skipTargetFind: true,     // Performance: no event handling needed
    selection: false,          // Performance: no selection overlay
    interactive: false         // Performance: no interactivity
  });

  return fabricCanvas;
}

async function replaceImagesWithHighRes(
  canvas: fabric.Canvas,
  elements: TemplateElement[]
): Promise<void> {
  // TODO: Extract high-res replacement logic from CanvasControls.tsx:287-321
  // Same logic: load original imageUrl, rasterize at 5x, replace Fabric object
}

export async function batchExportTemplates(
  templateIds: string[],
  options: ExportOptions,
  onBatchProgress?: (current: number, total: number) => void
): Promise<Map<string, ExportResult>> {
  const results = new Map<string, ExportResult>();

  for (let i = 0; i < templateIds.length; i++) {
    const templateId = templateIds[i];
    onBatchProgress?.(i + 1, templateIds.length);

    try {
      const result = await exportTemplateById(templateId, {
        ...options,
        onProgress: undefined // Don't pass individual progress for batch
      });
      results.set(templateId, result);
    } catch (error) {
      console.error(`Failed to export template ${templateId}:`, error);
      // Continue with next template
    }
  }

  return results;
}
```

---

### Phase 3: Extract High-Res Image Replacement

**Estimated:** 30 minutes

#### Step 3.1: Create `imageHighResReplacer.ts` Utility

**File:** `front-cards/features/template-textile/utils/imageHighResReplacer.ts`

**Purpose:** Reusable high-resolution image replacement logic

**Extract from:** `CanvasControls.tsx:287-321` (PNG export) and `:430-463` (JPG export)

**Exports:**
```typescript
export async function replaceImagesWithHighRes(
  canvas: fabric.Canvas,
  elements: TemplateElement[]
): Promise<fabric.Object[]>;
```

**Code:**
```typescript
import { fabric } from 'fabric';
import type { ImageElement, TemplateElement } from '../types';

export async function replaceImagesWithHighRes(
  canvas: fabric.Canvas,
  elements: TemplateElement[]
): Promise<fabric.Object[]> {
  const originalObjects: fabric.Object[] = [];
  const canvasObjects = canvas.getObjects();

  // Process each image element
  for (const element of elements) {
    if (element.type !== 'image') continue;

    const imgElement = element as ImageElement;
    const fabricObj = canvasObjects.find((obj: any) => obj.elementId === element.id);

    if (!fabricObj || fabricObj.type !== 'image') continue;

    // Save original object for restoration
    originalObjects.push(fabricObj);

    // Load high-res version
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgElement.imageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      // Calculate dimensions (5x multiplier for high-res)
      const renderWidth = img.naturalWidth || img.width;
      const renderHeight = img.naturalHeight || img.height;

      // Get current display dimensions
      const currentDisplayWidth = (fabricObj.width || 100) * (fabricObj.scaleX || 1);
      const currentDisplayHeight = (fabricObj.height || 100) * (fabricObj.scaleY || 1);

      // Calculate scale to fit (separate X/Y to preserve distortion)
      const scaleToFitX = currentDisplayWidth / renderWidth;
      const scaleToFitY = currentDisplayHeight / renderHeight;

      // Create high-res Fabric image
      const highResImage = new fabric.Image(img, {
        left: fabricObj.left,
        top: fabricObj.top,
        scaleX: scaleToFitX,
        scaleY: scaleToFitY,
        angle: fabricObj.angle,
        opacity: fabricObj.opacity,
        originX: fabricObj.originX,
        originY: fabricObj.originY,
        excludeFromExport: (fabricObj as any).excludeFromExport || false
      });

      // Store original URL for potential re-export
      (highResImage as any)._originalImageUrl = imgElement.imageUrl;
      (highResImage as any).elementId = element.id;

      // Replace in canvas
      canvas.remove(fabricObj);
      canvas.add(highResImage);
    } catch (error) {
      console.error(`Failed to load high-res image for element ${element.id}:`, error);
      // Keep original object if high-res fails
    }
  }

  canvas.renderAll();
  return originalObjects;
}

export function restoreOriginalImages(
  canvas: fabric.Canvas,
  originalObjects: fabric.Object[]
): void {
  // Remove high-res replacements
  const currentObjects = canvas.getObjects();
  const highResObjects = currentObjects.filter((obj: any) => obj._originalImageUrl);
  highResObjects.forEach(obj => canvas.remove(obj));

  // Restore originals
  originalObjects.forEach(obj => canvas.add(obj));
  canvas.renderAll();
}
```

#### Step 3.2: Update CanvasControls.tsx to Use Utility

**File:** `front-cards/features/template-textile/components/Canvas/CanvasControls.tsx`

Replace high-res replacement code with:
```typescript
import { replaceImagesWithHighRes, restoreOriginalImages } from '../utils/imageHighResReplacer';

// In handleExportPNG and handleExportJPG:
const originalImages = await replaceImagesWithHighRes(fabricCanvas, currentTemplate.elements);

// ... export logic ...

// Restore
restoreOriginalImages(fabricCanvas, originalImages);
```

---

### Phase 4: Add UI Integration

**Estimated:** 30 minutes

#### Step 4.1: Add Export Button to Template List

**File:** `front-cards/features/template-textile/components/TemplateList.tsx` (or create if doesn't exist)

**UI Changes:**
- Add "Export" button next to each template in list
- Show export options modal (format, width, quality)
- Show progress indicator during export
- Auto-download exported file

**Component:**
```typescript
import { exportTemplateById } from '../services/exportService';

function TemplateListItem({ template }: { template: TemplateMetadata }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const result = await exportTemplateById(template.id, {
        format: 'png',
        width: 2400,
        onProgress: (step, progress) => {
          setExportProgress(progress);
        }
      });

      // Trigger download
      downloadDataUrl(result.dataUrl, `${template.name}.${result.format}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. See console for details.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="template-list-item">
      <span>{template.name}</span>
      <button onClick={handleExport} disabled={isExporting}>
        {isExporting ? `Exporting... ${Math.round(exportProgress * 100)}%` : 'Export'}
      </button>
    </div>
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
```

#### Step 4.2: Add Batch Export Feature

**File:** `front-cards/features/template-textile/components/BatchExport.tsx`

**Features:**
- Select multiple templates
- Choose export options (format, width)
- Export all as ZIP
- Progress bar

**Uses:** `exportService.batchExportTemplates()`

---

## Testing Plan

### Unit Tests

**File:** `front-cards/features/template-textile/services/__tests__/exportService.test.ts`

```typescript
describe('exportService', () => {
  it('should export template without opening canvas', async () => {
    const mockTemplate = createMockTemplate();
    const result = await exportTemplate(mockTemplate, {
      format: 'png',
      width: 1200
    });

    expect(result.dataUrl).toStartWith('data:image/png');
    expect(result.width).toBe(1200);
  });

  it('should handle image loading errors gracefully', async () => {
    const templateWithBrokenImage = createTemplateWithBrokenImage();
    await expect(
      exportTemplate(templateWithBrokenImage, { format: 'png' })
    ).resolves.toBeDefined(); // Should not throw
  });

  it('should batch export multiple templates', async () => {
    const templateIds = ['id1', 'id2', 'id3'];
    const results = await batchExportTemplates(templateIds, {
      format: 'jpg',
      quality: 0.9
    });

    expect(results.size).toBe(3);
  });
});
```

### Integration Tests

1. **Export Closed Template**
   - Create template with text, image, shapes
   - Save template
   - Close template
   - Export via template list
   - ✅ Verify exported PNG matches original

2. **Batch Export**
   - Create 5 templates
   - Select all
   - Batch export
   - ✅ Verify 5 files downloaded

3. **High-Resolution Images**
   - Create template with SVG image
   - Export at 2x, 3x, 5x resolution
   - ✅ Verify images remain sharp

4. **Error Handling**
   - Template with missing image URL
   - ✅ Export should complete, skip broken image

### Manual Testing Checklist

- [ ] Export template that is currently open → works
- [ ] Export template that is closed → works
- [ ] Export multiple templates in batch → all succeed
- [ ] Export PNG with transparency → transparency preserved
- [ ] Export JPG with quality 0.5 → smaller file size
- [ ] Progress indicator updates during export
- [ ] Downloaded file has correct filename
- [ ] High-res images look sharp in export
- [ ] Multi-color text renders correctly
- [ ] QR codes are readable
- [ ] Shapes have correct colors/strokes

---

## Files to Create/Modify

### New Files (Create)

1. ✅ `front-cards/features/template-textile/services/canvasRenderer.ts`
   - Purpose: Reusable element recreation logic
   - Exports: `recreateElements()`
   - Lines: ~400

2. ✅ `front-cards/features/template-textile/services/exportService.ts`
   - Purpose: Off-screen export orchestration
   - Exports: `exportTemplateById()`, `exportTemplate()`, `batchExportTemplates()`
   - Lines: ~200

3. ✅ `front-cards/features/template-textile/utils/imageHighResReplacer.ts`
   - Purpose: High-res image replacement
   - Exports: `replaceImagesWithHighRes()`, `restoreOriginalImages()`
   - Lines: ~100

4. 🔲 `front-cards/features/template-textile/components/BatchExport.tsx`
   - Purpose: Batch export UI
   - Optional: Can be added later
   - Lines: ~150

### Modified Files

1. ✅ `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx`
   - Change: Use `canvasRenderer.recreateElements()` instead of inline logic
   - Lines affected: ~200 (deletion/refactor)

2. ✅ `front-cards/features/template-textile/components/Canvas/CanvasControls.tsx`
   - Change: Use `imageHighResReplacer` utility
   - Lines affected: ~50

3. 🔲 `front-cards/features/template-textile/components/TemplateList.tsx`
   - Change: Add export button to each template item
   - Lines affected: ~30 (addition)

---

## Rollout Plan

### Phase 1: Core Functionality (Priority 1)
1. Create `canvasRenderer.ts`
2. Create `exportService.ts`
3. Create `imageHighResReplacer.ts`
4. Update `DesignCanvas.tsx` to use renderer
5. Update `CanvasControls.tsx` to use replacer
6. **Test:** Export closed template works

### Phase 2: UI Integration (Priority 2)
1. Add export button to template list
2. Add export options modal
3. **Test:** One-click export from list

### Phase 3: Batch Features (Priority 3)
1. Create `BatchExport.tsx` component
2. Add multi-select to template list
3. Add ZIP download for batch exports
4. **Test:** Batch export 10+ templates

---

## Success Criteria

- ✅ Can export template without opening it in canvas
- ✅ Export quality matches on-screen export
- ✅ All element types render correctly (text, image, shape, QR)
- ✅ High-resolution images are sharp
- ✅ Memory is cleaned up (no leaks)
- ✅ Progress indicator works
- ✅ Error handling is graceful
- ✅ Batch export works for 10+ templates
- ✅ Existing on-screen export still works

---

## Future Enhancements

### 1. Server-Side Export (Backend Node.js)
- Use node-canvas for server rendering
- Enables batch processing of thousands of templates
- Requires: Native dependencies, font management

### 2. Export Templates
- Predefined export configurations
- Save as "Print Ready", "Web Optimized", "Social Media"
- Different sizes/formats/qualities

### 3. Scheduled Exports
- Export templates on schedule (nightly)
- Email results to user
- Integration with batch generation

### 4. Export Preview
- Show preview before exporting
- Crop/adjust before final export

---

## Risk Assessment

### Low Risk
- ✅ Logic already exists (just refactoring)
- ✅ No database changes
- ✅ No breaking changes to existing features

### Medium Risk
- ⚠️ Memory leaks if canvas not disposed properly
- ⚠️ Performance with large templates (many images)

**Mitigation:**
- Always use `try/finally` for canvas disposal
- Add timeout for batch exports
- Monitor memory usage during development

### High Risk
- ❌ None identified

---

## Questions/Decisions

### Q1: Should export modify template JSON?
**Decision:** No. Export is read-only operation.

### Q2: Should we cache exported images?
**Decision:** Not in Phase 1. Consider in Phase 3 for batch exports.

### Q3: What happens if template uses custom fonts?
**Decision:** Fonts must be loaded in browser. Document limitation.

### Q4: Maximum export resolution?
**Decision:** 10000px (same as Fabric.js limit). Warn if exceeded.

---

## Completion Checklist

- [ ] All new files created
- [ ] All modified files updated
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] PR created and reviewed
- [ ] Deployed to staging
- [ ] User acceptance testing
- [ ] Deployed to production

---

## References

- Feature Context: `.claude/features/FEATURE-TEMPLATE-TEXTILE-CONTEXT.md`
- Original Spec: `.claude/features/FEATURE-TEMPLATE-TEXTILE.md`
- Implementation Summary: `.claude/implementations/TEMPLATE-TEXTILE-IMPLEMENTATION-SUMMARY.md`
- Fabric.js Docs: https://fabricjs.com/docs/
- Node Canvas Reference: `D:\Projects\EPIC\tools-fabric-canvas-reference\node-canvas`
