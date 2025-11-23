# Template-Textile Feature Documentation

## Overview
Canvas-based template designer using Fabric.js v6 for creating business card/eCard templates with dynamic vCard field integration and batch generation support.

## Reference Codebases
When extending functionality or debugging Fabric.js/Canvas issues, refer to:
- **Fabric.js source**: `D:\Projects\EPIC\tools-fabric-reference\fabric.js`
- **Node Canvas reference**: `D:\Projects\EPIC\tools-fabric-canvas-reference\node-canvas`

## Core Components

### Frontend (`front-cards/features/template-textile/`)
- **TemplateDesigner**: Main container orchestrating canvas, toolbox, properties
- **DesignCanvas**: Fabric.js canvas with element manipulation and sync logic
- **CanvasControls**: Toolbar (zoom, pan, export, save, undo/redo)
- **PropertyPanel**: Context-sensitive property editor for selected elements
- **Toolbox**: Element creation tools (Text, Image, Shapes, QR, vCard fields)

### State Management
- **templateStore** (Zustand): Template data, elements, history (50 states), save metadata
- **canvasStore** (Zustand): Fabric canvas instance, zoom, selection, grid, pan mode

### Backend (`api-server/src/features/template-textile/`)
- **templateController**: REST API handlers for save/load/list operations
- **templateStorageService**: SeaweedFS storage with resource extraction and versioning
- **templateRoutes**: Express routes at `/api/v1/template-textile`

## Element Types

### BaseElement
```typescript
{
  id: string;
  type: 'text' | 'image' | 'qr' | 'shape';
  x: number;           // Canvas position
  y: number;
  width?: number;      // Display dimensions
  height?: number;
  rotation?: number;   // Degrees
  opacity?: number;    // 0-1
  locked?: boolean;    // Prevents selection/editing
  excludeFromExport?: boolean;  // Hide from exports
  // Line metadata for dynamic visibility
  sectionGroup?: string;
  lineGroup?: string;
  requiredFields?: string[];  // vCard fields needed
  linePriority?: number;
}
```

### TextElement
- Per-word colors: `colors?: string[]` (overrides `color`)
- vCard binding: `fieldId?: string`
- Font properties: `fontSize`, `fontFamily`, `fontWeight`, `fontStyle`, `underline`
- Stroke: `stroke`, `strokeWidth`
- Alignment: `textAlign`
- **Rendering**: Multi-color text uses `fabric.Group` with separate `fabric.Text` per word

### ImageElement
```typescript
{
  imageUrl: string;    // PNG/JPG data URL (full resolution)
  width: number;       // Box display width
  height: number;      // Box display height
  originalWidth: number;   // Original image dimensions
  originalHeight: number;
  scaleMode?: 'cover' | 'contain';
}
```

**CRITICAL Image Handling:**
1. **Import**: SVGs rasterized at **5x resolution** immediately (539x171 → 2695x857 PNG)
2. **Storage**: Full-resolution PNG data URLs stored in template JSON
3. **Display**: Fabric image keeps full resolution, uses `scaleX/scaleY` to fit box
4. **Scale Calculation**: `scaleX = boxWidth / imageWidth`, `scaleY = boxHeight / imageHeight`
5. **Save**: Images with HTTP URLs converted to PNG data URLs at full resolution
6. **Load**: Blob URL conversion via fetch to avoid CORS tainting
7. **Export**: High-res version created at 5x, scaled separately on X/Y to preserve distortion

### ShapeElement
- Types: `rectangle | circle | ellipse | line`
- Properties: `fill`, `stroke`, `strokeWidth`, `rx/ry` (rounded corners)

### QRElement
- Types: `url | text | vcard`
- Properties: `data`, `size`, `colorDark`, `colorLight`
- QR data regenerated on property change

## Critical Implementation Details

### Image Resolution Pipeline
```
SVG Import → Rasterize 5x → PNG DataURL (full-res) → Store in JSON
                                    ↓
                            Display via scale (scaleX/scaleY)
                                    ↓
         Manual resize → Update box (width/height) → Recalc scale
                                    ↓
                Save → Convert HTTP to PNG DataURL (full-res)
                                    ↓
                Load → Blob URL → fabric.Image (full-res) → Scale to box
                                    ↓
            Export → Create 5x high-res → Scale X/Y separately → Preserve distortion
```

**Key File: `ImageProperties.tsx:49-71`**
```typescript
// RASTERIZE at 5x resolution for high quality
const rasterWidth = svgWidth * 5;
const rasterHeight = svgHeight * 5;
canvas.width = rasterWidth;
canvas.height = rasterHeight;
ctx.drawImage(img, 0, 0, rasterWidth, rasterHeight);
const pngDataUrl = canvas.toDataURL('image/png', 1.0);
```

### Canvas Sync Logic (DesignCanvas.tsx)

**Two-way Sync:**
- **Canvas → Store**: Object modification events update store
- **Store → Canvas**: Store changes update fabric objects

**Position Sync:**
- Canvas is source of truth EXCEPT during undo/redo
- Undo/redo forces store position to canvas

**Image Dimension Sync (Lines 540-573):**
```typescript
// Images excluded from text width/height sync (line 510)
if (element.type !== 'qr' && element.type !== 'image') {
  // Text elements: set width/height, reset scale to 1
}

// Image scale sync: update scale when box dimensions change
const currentDisplayWidth = (fabricObj.width || 1) * (fabricObj.scaleX || 1);
const currentDisplayHeight = (fabricObj.height || 1) * (fabricObj.scaleY || 1);
if (Math.abs(currentDisplayWidth - imgEl.width) > 1) {
  const newScaleX = imgEl.width / fabricObj.width;
  const newScaleY = imgEl.height / fabricObj.height;
  fabricObj.set({ scaleX: newScaleX, scaleY: newScaleY });
}
```

**Image Recreation (Lines 404-412):**
- Only recreate if: placeholder (Rect) OR imageUrl changed
- NOT recreated on dimension changes (scale sync handles it)

### Export High-Res Logic (CanvasControls.tsx:287-321, 430-463)

**PNG/JPG Export:**
1. Remove grid and `excludeFromExport` objects
2. For each image with `_originalImageUrl`:
   - Load original URL
   - Rasterize at 5x resolution
   - Calculate **separate** `scaleToFitX` and `scaleToFitY`
   - Create fabric image with different X/Y scales (preserves distortion)
3. Export canvas with multiplier (e.g., 2x for 2400px from 1200px canvas)
4. Restore original objects

**Key Code (Lines 293-296, 319-320):**
```typescript
const currentDisplayWidth = (obj.width || 100) * (obj.scaleX || 1);
const currentDisplayHeight = (obj.height || 100) * (obj.scaleY || 1);
const scaleToFitX = currentDisplayWidth / renderWidth;
const scaleToFitY = currentDisplayHeight / renderHeight;
// ...
scaleX: scaleToFitX,  // Separate X/Y scales preserve distortion
scaleY: scaleToFitY,
```

### Cover/Contain (ImageProperties.tsx via PropertyPanel)
- **Cover**: Scale to fill box, crop overflow (larger scale wins)
- **Contain**: Scale to fit box, show all (smaller scale wins)
- Updates `width/height` in store → triggers scale sync in DesignCanvas

### Layer Order (Z-Index)
- Stored as array order in `template.elements`
- Fabric canvas order matches array order
- Sync maintains order during modifications
- Send to back/front modifies array order

### CORS Prevention
- All images converted to blob URLs on load: `fetch(url) → blob → URL.createObjectURL()`
- Prevents canvas tainting from cross-origin images
- File: `DesignCanvas.tsx:1267-1295`

### Multi-Color Text (multiColorText.ts)
- Splits text by whitespace: `text.split(/\s+/)`
- Creates `fabric.Text` per word with color from `colors[index]`
- Positions with space width calculation
- Groups into `fabric.Group`
- Stores `elementId`, `isMultiColorText`, `originalElement` on group

## State Synchronization Flow

```
User Action (canvas drag, property edit, keyboard)
    ↓
Event Handler (DesignCanvas, PropertyPanel)
    ↓
Store Update (updateElement, addElement, etc.)
    ↓
useEffect Sync Loop (DesignCanvas:369-608)
    ↓
Fabric Object Update (set properties, setCoords, renderAll)
```

**Sync Prevention:**
- `processingModification` ref prevents circular updates
- Undo/redo timestamp detection: `lastUndoRedoTimestamp`

## Export Behavior

### PNG/JPG
- Full canvas export (ignores zoom/pan)
- Viewport reset to `[1,0,0,1,0,0]`, zoom to 1
- Multiplier: `exportWidth / canvasWidth`
- Grid and `excludeFromExport` objects removed
- Images replaced with 5x high-res versions
- Separate scaleX/scaleY to preserve distortion

### SVG
- Not implemented (Fabric.js toSVG has limitations with embedded images)

## Keyboard Shortcuts
- **Ctrl/Cmd+S**: Save template
- **Ctrl/Cmd+Z**: Undo
- **Ctrl/Cmd+Y**: Redo
- **Delete/Backspace**: Delete selected (disabled in inputs)
- **Spacebar**: Pan mode (hold)

## Key Files Reference

### Critical Image Logic
- `ImageProperties.tsx:36-153` - SVG 5x rasterization, PNG/JPG import, dimensions
- `DesignCanvas.tsx:404-412` - Image recreation conditions
- `DesignCanvas.tsx:510-526` - Text dimension sync (images EXCLUDED)
- `DesignCanvas.tsx:540-573` - Image scale sync
- `DesignCanvas.tsx:1267-1347` - Image loading with blob URLs
- `CanvasControls.tsx:287-321` - PNG high-res export with distortion preservation
- `CanvasControls.tsx:430-463` - JPG high-res export with distortion preservation

### Critical Sync Logic
- `DesignCanvas.tsx:369-608` - Main sync loop
- `DesignCanvas.tsx:123-244` - Canvas event handlers (modified, selection, moving)
- `templateStore.ts` - All state mutations

### Save/Load
- `CanvasControls.tsx:152-184` - Save with rasterization
- `CanvasControls.tsx:32-73` - Image rasterization before save
- `CanvasControls.tsx:186-212` - Load template

## Common Issues & Solutions

### Images blurry after save/load
**Cause**: SVGs stored as SVG URLs, rasterized at display size
**Solution**: Rasterize SVGs at 5x DURING IMPORT (ImageProperties.tsx:49-71)

### Images not fitting box after Cover/Contain
**Cause**: Scale reset by text sync logic
**Solution**: Exclude images from text dimension sync (line 510: `&& element.type !== 'image'`)

### Export doesn't match canvas (distortion lost)
**Cause**: Export uses single scale for both X/Y
**Solution**: Calculate separate `scaleToFitX` and `scaleToFitY` (CanvasControls.tsx:293-296)

### CORS tainting on export
**Cause**: Images loaded from cross-origin HTTP URLs
**Solution**: Convert all URLs to blob URLs on load (DesignCanvas.tsx:1279-1287)

### No-output not working
**Cause**: Property not synced from store to fabric object
**Solution**: Sync `excludeFromExport` in sync loop (DesignCanvas.tsx:574-578)

## Version History & Versioning
- Keeps last 3 versions per template
- Version metadata includes timestamp, size
- Automatic cleanup of old versions

## Performance Notes
- Max 50 history states (memory limit)
- Image data URLs can be large (base64 overhead)
- Sync loop runs on every store update (optimized with dirty checks)
- Multi-color text creates multiple fabric objects per element
