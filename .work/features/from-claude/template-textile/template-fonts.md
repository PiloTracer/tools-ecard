# Template Fonts - Font Management Sub-Feature

## Purpose
Standalone font management system for loading, displaying, and managing custom fonts in the template editor. Provides both system fonts (Google Fonts) and user-uploaded custom fonts.

## Scope
- Font loading and caching (client-side)
- Font upload (user custom fonts)
- Font deletion (user fonts only)
- Font discovery and selection UI
- Font preview with live rendering
- Google Fonts integration (server-side auto-load)

## Key Files

### Frontend Components
- `components/PropertyPanel/FontSelector.tsx` - Font selection UI with upload
  - Search and filter fonts
  - Category filtering (serif, sans-serif, etc.)
  - Scope filtering (all, system, user)
  - Live font preview on hover
  - Font upload modal

### Frontend Services
- `services/fontService.ts` - Client-side font management
  - `listFonts(scope)` - Fetch available fonts
  - `loadFont(font)` - Dynamically inject @font-face CSS
  - `uploadFont(file, metadata)` - Upload custom font
  - `deleteFont(fontId)` - Delete user font
  - `getFontFamilies(fonts)` - Group fonts by family

### Backend (API Server)
- `api-server/src/features/font-management/`
  - `controllers/fontController.ts` - HTTP endpoints
  - `services/fontService.ts` - Business logic
  - `routes/fontRoutes.ts` - Route registration
  - `types/index.ts` - Font types and interfaces

## Database Schema (Cassandra)

### Table: fonts
```sql
CREATE TABLE fonts (
  user_id text,              -- Partition key: 'GLOBAL' or user ID
  font_id text,              -- Clustering key
  font_name text,
  font_family text,
  font_category text,        -- serif, sans-serif, display, handwriting, monospace
  font_variant text,         -- regular, bold, italic, bold-italic
  font_weight int,
  font_style text,           -- normal, italic
  is_system_font boolean,
  seaweedfs_fid text,        -- SeaweedFS file ID
  created_at timestamp,
  PRIMARY KEY (user_id, font_id)
);
```

## Font Types

### Frontend (TypeScript)
```typescript
interface Font {
  fontId: string;
  userId: string | null;     // 'GLOBAL' for system fonts
  fontName: string;
  fontFamily: string;
  fontCategory: string;
  fontVariant: string;
  fontWeight: number;
  fontStyle: string;
  isSystemFont: boolean;
}

interface FontFamily {
  family: string;
  category: string;
  variants: Font[];
}
```

## API Endpoints

### GET /api/v1/fonts
Query params: `scope` (global|user|all), `category`, `search`
Returns: `{ fonts: Font[] }`

### POST /api/v1/fonts
Multipart form data:
- `file` - Font file (.woff2, .woff, .ttf, .otf, .ttc)
- `fontName` - Display name
- `fontFamily` - CSS font-family
- `fontCategory` - Category
- `fontVariant` - Variant name
- `fontWeight` - Font weight (100-900)
- `fontStyle` - normal|italic

Validation:
- Max file size: 10MB
- Supported formats: .woff2, .woff, .ttf, .otf, .ttc

Returns: `{ font: Font }`

### DELETE /api/v1/fonts/:fontId
Deletes user's custom font (system fonts protected)

### GET /api/v1/fonts/:fontId/file
Query params: `userId` (optional, for user fonts)
Returns: Font file binary (with proper Content-Type header)
Headers:
- `Content-Type`: font/woff2, font/woff, font/ttf, font/otf, font/collection
- `Cache-Control`: public, max-age=31536000 (1 year)
- `Access-Control-Allow-Origin`: * (for @font-face)

## Font Loading Flow

### Client-Side
1. User opens template or font selector
2. `fontService.listFonts('all')` - Fetch system + user fonts
3. Group by family: `getFontFamilies(fonts)`
4. Display in FontSelector UI
5. On hover: `loadFont(font)` - Inject @font-face CSS
6. Font cached in `loadedFonts` Set (per session)

### CSS Injection
```typescript
const style = document.createElement('style');
style.textContent = `
  @font-face {
    font-family: '${font.fontFamily}';
    src: url('${API_URL}/api/v1/fonts/${font.fontId}/file');
    font-weight: ${font.fontWeight};
    font-style: ${font.fontStyle};
    font-display: swap;
  }
`;
document.head.appendChild(style);
```

## Font Upload Flow

1. User selects file in FontUploadModal
2. Client validates:
   - File extension (.woff2, .woff, .ttf, .otf, .ttc)
   - File size (max 10MB)
3. Auto-fill font name from filename
4. User provides: fontFamily, category, variant, weight, style
5. POST to `/api/v1/fonts` with FormData
6. Server validates and uploads to SeaweedFS
7. Server stores metadata in Cassandra
8. Returns Font object
9. Client loads font immediately
10. Font appears in selector

## Google Fonts Integration

### Server Startup
- `scripts/loadGoogleFonts.ts` - Auto-load curated fonts on startup
- Fetches 30 popular Google Fonts
- Downloads .ttf files from Google Fonts CDN
- Uploads to SeaweedFS
- Stores in Cassandra with `userId='GLOBAL'`
- Creates 84 font variants total

## Font Isolation

### System Fonts (GLOBAL)
- `userId = 'GLOBAL'`
- Available to ALL users
- Cannot be deleted
- Auto-loaded Google Fonts + manually added system fonts

### User Fonts
- `userId = 'user-123'`
- Only visible to that specific user
- Can be deleted by owner
- Isolated by Cassandra partition key

### Security
- Users can only delete their own fonts
- System fonts (isSystemFont=true) are protected
- Font files served with CORS headers for @font-face

## Dependencies

### Internal
- **template-textile-core** - Uses fonts in text elements

### External
- `@fastify/multipart` - File upload handling
- `cassandra-driver` - Database
- `axios` - Google Fonts API
- SeaweedFS - File storage

## Migration Notes

When moving to `features/template-fonts/`:
1. Move `services/fontService.ts` → `features/template-fonts/services/fontService.ts`
2. Move `components/PropertyPanel/FontSelector.tsx` → `features/template-fonts/components/FontSelector.tsx`
3. Keep backend in `api-server/src/features/font-management/` (already separated)
4. Update imports in template-textile-core
5. Export public API from `features/template-fonts/index.ts`

## Public API (for other features)

```typescript
// features/template-fonts/index.ts
export { fontService } from './services/fontService';
export { FontSelector } from './components/FontSelector';
export type { Font, FontFamily } from './types';
```

## Notes
- Font management is FULLY ISOLATED from template editing
- Can be reused in other features (e.g., email editor, document editor)
- Font loading is lazy (on-demand) for performance
- Fonts are cached per browser session
