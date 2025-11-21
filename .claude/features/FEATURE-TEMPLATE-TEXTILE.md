# Template-Textile Feature Documentation

## Feature Overview
Template-Textile is a comprehensive canvas-based template designer for creating business card and eCard templates using Fabric.js. It provides a visual design environment where users can create, edit, and export templates with dynamic vCard field integration, allowing for batch generation of personalized cards from employee data.

## Key Components

### Frontend Components (`front-cards/features/template-textile/`)

| Component | Location | Purpose |
|-----------|----------|---------|
| **TemplateDesigner** | `components/TemplateDesigner.tsx` | Main container component that orchestrates the entire designer |
| **DesignCanvas** | `components/Canvas/DesignCanvas.tsx` | Core Fabric.js canvas implementation with element manipulation |
| **CanvasControls** | `components/Canvas/CanvasControls.tsx` | Toolbar with zoom, export, save, and canvas control buttons |
| **CanvasSettings** | `components/CanvasSettings/` | Panel for canvas dimensions and export settings |
| **PropertyPanel** | `components/PropertyPanel/` | Context-sensitive property editor for selected elements |
| **Toolbox** | `components/Toolbox/` | Element creation tools (Text, Image, Shapes, vCard fields) |
| **SaveModal** | `components/SaveModal/SaveTemplateModal.tsx` | Modal dialog for saving templates with project/name |
| **TemplateStatus** | `components/TemplateStatus/TemplateStatus.tsx` | Status bar showing save state and template name |

### State Management (`front-cards/features/template-textile/stores/`)

| Store | Purpose | Key State |
|-------|---------|-----------|
| **templateStore** | Template data and history | `currentTemplate`, `elements`, `canvasDimensions`, `history`, `saveMetadata` |
| **canvasStore** | Canvas view and interaction | `fabricCanvas`, `zoom`, `selectedElement`, `grid`, `panMode` |

### Services & Utils (`front-cards/features/template-textile/`)

| Service/Util | Location | Purpose |
|--------------|----------|---------|
| **templateService** | `services/templateService.ts` | API communication for save/load operations |
| **vcardFields** | `utils/vcardFields.ts` | vCard field definitions and helpers |
| **multiColorText** | `utils/multiColorText.ts` | Per-word color text rendering |

### Backend API (`api-server/src/features/template-textile/`)

| Component | Location | Purpose |
|-----------|----------|---------|
| **templateController** | `controllers/templateController.ts` | REST API request handlers |
| **templateStorageService** | `services/templateStorageService.ts` | SeaweedFS storage operations |
| **templateRoutes** | `routes/templateRoutes.ts` | Express route definitions |

## Core Functionality

### Canvas Operations
- **Zoom Controls**: Zoom in/out (10-300%), reset zoom to 100%
- **Pan Mode**: Spacebar-activated pan mode for navigating large canvases
- **Reset View**: Button to reset zoom to 100% and center canvas
- **Grid System**: Toggle grid display and snap-to-grid functionality
- **Background Color**: Customizable canvas background

### Element Types

#### Text Elements
```typescript
{
  type: 'text',
  text: string,
  fontSize: number,
  fontFamily: string,
  color?: string,          // Single color (backward compatible)
  colors?: string[],        // Per-word colors array
  fieldId?: string,         // vCard field binding
  sectionGroup?: string,    // Logical section grouping
  lineGroup?: string,       // Line grouping for visibility
  requiredFields?: string[], // Fields needed for visibility
  linePriority?: number     // Reordering priority
}
```

#### Image Elements
```typescript
{
  type: 'image',
  imageUrl: string,
  width: number,
  height: number,
  scaleMode: 'fill' | 'fit' | 'stretch'
}
```

#### Shape Elements
```typescript
{
  type: 'shape',
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'line',
  fill?: string,
  stroke?: string,
  strokeWidth?: number
}
```

#### QR Code Elements
```typescript
{
  type: 'qr',
  data: string,
  qrType: 'url' | 'text' | 'vcard',
  size: number,
  colorDark?: string,
  colorLight?: string
}
```

### vCard Integration
- **Field Binding**: Text elements can be bound to vCard fields for dynamic content
- **Categories**: Core, Business, and Personal field categories
- **Dynamic Visibility**: Elements show/hide based on available vCard data
- **Line Metadata**: Advanced control over element visibility and grouping

### Line Metadata Properties
| Property | Purpose | Example |
|----------|---------|---------|
| `sectionGroup` | Groups lines into logical sections | `"contact-info"`, `"business-details"` |
| `lineGroup` | Groups elements on same line | `"contact-line-1"`, `"address-line"` |
| `requiredFields` | vCard fields required for visibility | `["work_phone", "mobile_phone"]` |
| `linePriority` | Ordering priority for dynamic reflow | `1`, `2`, `3` |

### Export Functionality
- **Formats**: PNG, JPG, SVG export
- **Resolution**: 5x upscaling for high-quality raster exports
- **Behavior**: Always exports full canvas (not just viewport)
- **Export Width**: Configurable target width with proportional scaling

### Template Management
- **Save/Load**: Store templates in SeaweedFS with versioning
- **Project Organization**: Templates organized by project and name
- **Version History**: Automatic versioning (keeps last 3 versions)
- **Auto-save Metadata**: Tracks last saved time and unsaved changes

## Data Structures

### Template Structure
```typescript
interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: TemplateElement[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Base Element Interface
```typescript
interface BaseElement {
  id: string;
  type: 'text' | 'image' | 'qr' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  // Line metadata
  sectionGroup?: string;
  lineGroup?: string;
  requiredFields?: string[];
  linePriority?: number;
}
```

## Technical Details

### Keyboard Shortcuts
- **Ctrl+S / Cmd+S**: Save template
- **Spacebar**: Activate pan mode (hold)
- **Delete/Backspace**: Delete selected element (disabled in input fields)
- **Ctrl+Z / Cmd+Z**: Undo
- **Ctrl+Y / Cmd+Y**: Redo

### Canvas Export Behavior
- SVG exports use 5x upscaling for high resolution
- Canvas dimensions separate from export dimensions
- Maintains aspect ratio during export
- Full canvas export (ignores viewport/zoom)

### Performance Optimizations
- Fabric.js native grouping for complex layouts
- Template cloning for batch generation
- Preloaded icon resources
- Efficient history management (50 states max)

## File Structure

```
front-cards/features/template-textile/
├── components/
│   ├── Canvas/
│   │   ├── DesignCanvas.tsx        # Main canvas component
│   │   └── CanvasControls.tsx      # Toolbar controls
│   ├── CanvasSettings/             # Canvas dimension settings
│   ├── PropertyPanel/              # Element property editor
│   ├── SaveModal/                  # Save dialog
│   ├── TemplateStatus/             # Status bar
│   ├── Toolbox/                    # Element creation tools
│   └── TemplateDesigner.tsx        # Main container
├── stores/
│   ├── canvasStore.ts              # Canvas state
│   └── templateStore.ts            # Template data state
├── services/
│   └── templateService.ts          # API client
├── types/
│   └── index.ts                    # TypeScript interfaces
├── utils/
│   ├── vcardFields.ts              # vCard field definitions
│   └── multiColorText.ts           # Per-word coloring
└── index.ts                        # Public exports

api-server/src/features/template-textile/
├── controllers/
│   └── templateController.ts       # REST handlers
├── services/
│   └── templateStorageService.ts   # Storage operations
├── routes/
│   └── templateRoutes.ts           # Route definitions
├── types/
│   └── index.ts                    # Backend types
└── index.ts                        # Feature registration
```

## Recent Implementations

### Completed Features
- ✅ **Reset View Button**: Resets zoom to 100% and centers canvas
- ✅ **Section Group Metadata**: Groups lines into logical sections
- ✅ **Per-Word Color Support**: Individual color for each word in text
- ✅ **Template Save/Load**: Full persistence with SeaweedFS
- ✅ **Canvas Export Fixes**: Proper full-canvas export behavior
- ✅ **Version History**: Automatic versioning with 3-version retention
- ✅ **Keyboard Shortcuts**: Ctrl+S save, spacebar pan
- ✅ **Template Status Bar**: Shows save state and template info

### Implementation Guides
- `PER_WORD_COLOR_IMPLEMENTATION.md`: Per-word coloring details
- `RESET-VIEW-IMPLEMENTATION.md`: Reset view button implementation
- `SAVE-TEMPLATE-IMPLEMENTATION.md`: Save/load functionality details

## Integration Points

### Backend API
- **Base URL**: `/api/v1/template-textile`
- **Authentication**: JWT token required (Bearer auth)
- **Storage**: SeaweedFS for template and resource storage

### SeaweedFS Storage
- **Templates**: Stored as JSON with metadata
- **Resources**: Images extracted and stored separately
- **Versioning**: Automatic version management

### Authentication
- User context from JWT token
- Templates scoped to authenticated user
- Project-based organization

### Related Features
- **vCard System**: Integration with employee vCard data
- **Batch Generation**: Templates used for bulk card creation
- **Export System**: Integration with image export services

## Usage Flow

1. **Create Template**: User creates new template with dimensions
2. **Add Elements**: Drag elements from toolbox to canvas
3. **Configure Properties**: Edit element properties in property panel
4. **Bind vCard Fields**: Connect text elements to vCard fields
5. **Set Line Metadata**: Configure visibility rules and grouping
6. **Save Template**: Save with project and template name
7. **Export/Generate**: Export as image or use for batch generation

## Key Design Decisions

1. **Fabric.js over HTML Canvas**: Provides rich object model and interaction
2. **Line Metadata**: Enables dynamic layout without complex table structures
3. **Per-Word Colors**: Allows granular text styling for brand consistency
4. **Project Organization**: Helps manage multiple template sets
5. **5x Export Scaling**: Ensures high-quality output for print/digital use
6. **Separate Canvas/Export Dimensions**: Flexibility in design vs output size

## Performance Considerations

- **Element Limits**: Recommended max 100 elements per template
- **Image Optimization**: Compress images before upload
- **History States**: Limited to 50 for memory efficiency
- **Batch Generation**: Clone templates rather than recreate
- **Resource Preloading**: Load all assets before batch operations

## Future Enhancements (Potential)
- Layer management system
- Template inheritance/variants
- Advanced alignment tools
- Custom font upload
- Animation support for digital cards
- Collaborative editing
- Template marketplace/sharing