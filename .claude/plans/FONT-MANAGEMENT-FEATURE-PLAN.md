# Font Management Feature - Implementation Plan

**Date:** 2025-11-26
**Feature:** font-management
**Status:** Planning

## Overview

A comprehensive font management system that provides:
1. **Global Fonts** - System-wide fonts (Google Fonts) available to all users
2. **User Fonts** - Custom fonts uploaded by individual users, private to that user
3. **Font Preview** - Live font previews in the font selector
4. **Automatic Loading** - Auto-load curated Google Fonts on startup
5. **SeaweedFS Storage** - All font files stored in SeaweedFS for scalability

---

## 1. Database Schema (Cassandra)

### Table: `fonts`

```sql
CREATE TABLE IF NOT EXISTS fonts (
    font_id text,              -- UUID for the font
    user_id text,              -- User who uploaded (NULL for global fonts)
    font_name text,            -- Display name (e.g., "Montserrat Bold")
    font_family text,          -- CSS font-family value (e.g., "Montserrat")
    font_category text,        -- 'serif', 'sans-serif', 'display', 'handwriting', 'monospace'
    font_variant text,         -- 'regular', 'bold', 'italic', 'bold-italic'
    font_weight int,           -- 400, 700, etc.
    font_style text,           -- 'normal', 'italic'
    seaweedfs_url text,        -- SeaweedFS file URL
    seaweedfs_fid text,        -- SeaweedFS file ID (for deletion)
    google_font_family text,   -- Original Google Font family name (if applicable)
    is_system_font boolean,    -- true for global fonts, false for user uploads
    file_size bigint,          -- File size in bytes
    created_at timestamp,
    created_by text,           -- Admin who loaded global font
    PRIMARY KEY ((user_id), font_id)
);

-- Index for querying global fonts
CREATE INDEX IF NOT EXISTS ON fonts (is_system_font);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS ON fonts (font_category);

-- Index for font family lookup
CREATE INDEX IF NOT EXISTS ON fonts (font_family);
```

**Partitioning Strategy:**
- Partition key: `user_id`
- Global fonts: `user_id = NULL` (single partition for all global fonts)
- User fonts: `user_id = <userId>` (separate partition per user)

This allows efficient queries:
- List global fonts: `WHERE user_id = NULL AND is_system_font = true`
- List user fonts: `WHERE user_id = ? AND is_system_font = false`
- List all available fonts for a user: Query both global and user partitions

---

## 2. Backend Implementation

### 2.1 Types (`types/index.ts`)

```typescript
export interface Font {
  fontId: string;
  userId: string | null;
  fontName: string;
  fontFamily: string;
  fontCategory: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  fontVariant: 'regular' | 'bold' | 'italic' | 'bold-italic';
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  seaweedfsUrl: string;
  seaweedfsFid: string;
  googleFontFamily?: string;
  isSystemFont: boolean;
  fileSize: number;
  createdAt: Date;
  createdBy: string;
}

export interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
}

export interface FontUploadRequest {
  fontName: string;
  fontFamily: string;
  fontCategory: string;
  fontVariant: string;
  fontWeight: number;
  fontStyle: string;
  file: Buffer;
  fileName: string;
}
```

### 2.2 Font Service (`services/fontService.ts`)

**Key Methods:**

```typescript
class FontService {
  // ==================== GLOBAL FONTS ====================

  /**
   * List all global (system) fonts
   */
  async listGlobalFonts(filters?: {
    category?: string;
    search?: string;
  }): Promise<Font[]>;

  /**
   * Load a single Google Font family (all variants)
   * Downloads from Google Fonts API and uploads to SeaweedFS
   */
  async loadGoogleFont(fontFamily: string, category: string): Promise<Font[]>;

  /**
   * Check if a global font already exists
   */
  async globalFontExists(fontFamily: string): Promise<boolean>;

  // ==================== USER FONTS ====================

  /**
   * List fonts uploaded by a specific user
   */
  async listUserFonts(userId: string, filters?: {
    category?: string;
    search?: string;
  }): Promise<Font[]>;

  /**
   * List all available fonts for a user (global + user fonts)
   */
  async listAvailableFonts(userId: string, filters?: {
    category?: string;
    search?: string;
  }): Promise<Font[]>;

  /**
   * Upload a custom font for a specific user
   */
  async uploadUserFont(userId: string, request: FontUploadRequest): Promise<Font>;

  /**
   * Delete a user font
   */
  async deleteUserFont(userId: string, fontId: string): Promise<void>;

  // ==================== FONT FILE OPERATIONS ====================

  /**
   * Download a font file from SeaweedFS
   */
  async getFontFile(fontId: string, userId?: string): Promise<Buffer>;

  /**
   * Delete a font file from SeaweedFS
   */
  async deleteFontFile(seaweedfsFid: string): Promise<void>;

  // ==================== GOOGLE FONTS INTEGRATION ====================

  /**
   * Download .woff2 file from Google Fonts
   */
  private async downloadGoogleFontVariant(
    fontFamily: string,
    variant: string
  ): Promise<Buffer>;

  /**
   * Upload font buffer to SeaweedFS
   */
  private async uploadToSeaweedFS(
    buffer: Buffer,
    fileName: string
  ): Promise<{ url: string; fid: string }>;

  /**
   * Parse Google Fonts CSS to extract .woff2 URLs
   */
  private async parseGoogleFontsCss(fontFamily: string): Promise<{
    variant: string;
    weight: number;
    style: string;
    url: string;
  }[]>;
}
```

### 2.3 Font Controller (`controllers/fontController.ts`)

**Endpoints:**

```typescript
class FontController {
  /**
   * GET /api/v1/fonts
   * List fonts available to the authenticated user
   * Query params:
   *   - scope: 'global' | 'user' | 'all' (default: 'all')
   *   - category: filter by category
   *   - search: search query
   */
  async listFonts(request: FastifyRequest, reply: FastifyReply): Promise<void>;

  /**
   * POST /api/v1/fonts
   * Upload a custom font for the authenticated user
   * Content-Type: multipart/form-data
   * Fields:
   *   - file: font file (.woff2, .ttf, .otf)
   *   - fontName: display name
   *   - fontFamily: CSS font-family
   *   - fontCategory: category
   *   - fontVariant: variant
   *   - fontWeight: weight
   *   - fontStyle: style
   */
  async uploadFont(request: FastifyRequest, reply: FastifyReply): Promise<void>;

  /**
   * DELETE /api/v1/fonts/:fontId
   * Delete a user's custom font
   */
  async deleteFont(request: FastifyRequest, reply: FastifyReply): Promise<void>;

  /**
   * GET /api/v1/fonts/:fontId/file
   * Get font file (public endpoint for @font-face)
   * Query params:
   *   - userId: optional, for user fonts
   */
  async getFontFile(request: FastifyRequest, reply: FastifyReply): Promise<void>;
}
```

### 2.4 Routes (`routes/fontRoutes.ts`)

```typescript
const fontRoutes: FastifyPluginAsync = async (fastify) => {
  // Public endpoint for font files (needed for @font-face CSS)
  fastify.get('/api/v1/fonts/:fontId/file', fontController.getFontFile);

  // Protected endpoints (require authentication)
  fastify.addHook('preHandler', authMiddleware);

  fastify.get('/api/v1/fonts', fontController.listFonts);
  fastify.post('/api/v1/fonts', fontController.uploadFont);
  fastify.delete('/api/v1/fonts/:fontId', fontController.deleteFont);
};
```

### 2.5 Startup Script (`startup/loadGoogleFonts.ts`)

**Curated Google Fonts List (30 fonts):**

```typescript
const CURATED_GOOGLE_FONTS: { family: string; category: string }[] = [
  // Serif (5)
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },

  // Sans-Serif (10)
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Source Sans Pro', category: 'sans-serif' },

  // Display (7)
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Lobster', category: 'display' },
  { family: 'Pacifico', category: 'display' },
  { family: 'Oswald', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },

  // Handwriting (5)
  { family: 'Parisienne', category: 'handwriting' },
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Allura', category: 'handwriting' },

  // Monospace (3)
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
];

/**
 * Load curated Google Fonts on server startup
 * Checks if fonts exist before downloading
 */
export async function loadGoogleFonts(fontService: FontService): Promise<void> {
  console.log('[Google Fonts] Starting auto-load...');

  for (const { family, category } of CURATED_GOOGLE_FONTS) {
    try {
      // Check if font already exists
      const exists = await fontService.globalFontExists(family);

      if (exists) {
        console.log(`[Google Fonts] Skipping "${family}" (already exists)`);
        continue;
      }

      // Download and upload font
      console.log(`[Google Fonts] Loading "${family}"...`);
      const fonts = await fontService.loadGoogleFont(family, category);
      console.log(`[Google Fonts] Loaded "${family}" (${fonts.length} variants)`);
    } catch (error) {
      console.error(`[Google Fonts] Failed to load "${family}":`, error);
      // Continue with next font
    }
  }

  console.log('[Google Fonts] Auto-load complete');
}
```

**Server Integration:**

In `api-server/src/server.ts` or startup file:

```typescript
import { loadGoogleFonts } from './features/font-management/startup/loadGoogleFonts';
import { fontService } from './features/font-management/services/fontService';

// After server initialization
server.listen({ port: 7400, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }

  console.log(`Server listening on ${address}`);

  // Load Google Fonts in background (don't block startup)
  loadGoogleFonts(fontService).catch(err => {
    console.error('[Startup] Failed to load Google Fonts:', err);
  });
});
```

---

## 3. Frontend Implementation

### 3.1 Font Service (`front-cards/features/template-textile/services/fontService.ts`)

```typescript
export interface Font {
  fontId: string;
  userId: string | null;
  fontName: string;
  fontFamily: string;
  fontCategory: string;
  fontVariant: string;
  fontWeight: number;
  fontStyle: string;
  isSystemFont: boolean;
}

class FontService {
  private loadedFonts: Set<string> = new Set();
  private cachedFonts: Font[] = [];

  /**
   * Fetch available fonts for the current user
   */
  async listFonts(scope: 'global' | 'user' | 'all' = 'all'): Promise<Font[]> {
    const response = await apiClient.get<{ fonts: Font[] }>(
      `/api/v1/fonts?scope=${scope}`
    );
    this.cachedFonts = response.fonts;
    return response.fonts;
  }

  /**
   * Load a font dynamically by injecting @font-face
   */
  async loadFont(font: Font): Promise<void> {
    const cacheKey = `${font.fontFamily}-${font.fontVariant}`;

    if (this.loadedFonts.has(cacheKey)) {
      return; // Already loaded
    }

    const fontUrl = `/api/v1/fonts/${font.fontId}/file${
      font.userId ? `?userId=${font.userId}` : ''
    }`;

    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: '${font.fontFamily}';
        src: url('${fontUrl}') format('woff2');
        font-weight: ${font.fontWeight};
        font-style: ${font.fontStyle};
        font-display: swap;
      }
    `;
    document.head.appendChild(style);

    this.loadedFonts.add(cacheKey);
  }

  /**
   * Upload a custom font
   */
  async uploadFont(file: File, metadata: {
    fontName: string;
    fontFamily: string;
    fontCategory: string;
    fontVariant: string;
    fontWeight: number;
    fontStyle: string;
  }): Promise<Font> {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const response = await fetch('/api/v1/fonts', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload font');
    }

    const { font } = await response.json();
    return font;
  }

  /**
   * Delete a custom font
   */
  async deleteFont(fontId: string): Promise<void> {
    await apiClient.delete(`/api/v1/fonts/${fontId}`);
  }

  /**
   * Get unique font families (group by font family)
   */
  getFontFamilies(fonts: Font[]): { family: string; category: string; variants: Font[] }[] {
    const familyMap = new Map<string, Font[]>();

    fonts.forEach(font => {
      if (!familyMap.has(font.fontFamily)) {
        familyMap.set(font.fontFamily, []);
      }
      familyMap.get(font.fontFamily)!.push(font);
    });

    return Array.from(familyMap.entries()).map(([family, variants]) => ({
      family,
      category: variants[0].fontCategory,
      variants,
    }));
  }
}

export const fontService = new FontService();
```

### 3.2 Font Selector Component (`components/PropertyPanel/FontSelector.tsx`)

```tsx
interface FontSelectorProps {
  value: string; // current font family
  onChange: (fontFamily: string) => void;
  onFontLoad?: (font: Font) => void;
}

export function FontSelector({ value, onChange, onFontLoad }: FontSelectorProps) {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [fontFamilies, setFontFamilies] = useState<ReturnType<typeof fontService.getFontFamilies>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [scope, setScope] = useState<'all' | 'global' | 'user'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredFont, setHoveredFont] = useState<string | null>(null);

  // Load fonts on mount
  useEffect(() => {
    loadFonts();
  }, [scope]);

  const loadFonts = async () => {
    setIsLoading(true);
    try {
      const loadedFonts = await fontService.listFonts(scope);
      setFonts(loadedFonts);
      setFontFamilies(fontService.getFontFamilies(loadedFonts));
    } catch (error) {
      console.error('Failed to load fonts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy load font on hover
  const handleFontHover = async (family: string) => {
    setHoveredFont(family);

    const familyFonts = fontFamilies.find(f => f.family === family);
    if (!familyFonts) return;

    // Load regular variant for preview
    const regularFont = familyFonts.variants.find(v => v.fontVariant === 'regular') || familyFonts.variants[0];

    try {
      await fontService.loadFont(regularFont);
      if (onFontLoad) onFontLoad(regularFont);
    } catch (error) {
      console.error('Failed to load font:', error);
    }
  };

  // Filter fonts
  const filteredFamilies = fontFamilies.filter(({ family, category }) => {
    const matchesSearch = searchQuery === '' ||
      family.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort: selected first, then alphabetically
  const sortedFamilies = [...filteredFamilies].sort((a, b) => {
    if (a.family === value) return -1;
    if (b.family === value) return 1;
    return a.family.localeCompare(b.family);
  });

  return (
    <div className="font-selector space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search fonts..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
        />
        <svg className="absolute right-2 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Scope Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setScope('all')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Fonts
        </button>
        <button
          onClick={() => setScope('global')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'global'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          System
        </button>
        <button
          onClick={() => setScope('user')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            scope === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          My Fonts
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {['all', 'serif', 'sans-serif', 'display', 'handwriting', 'monospace'].map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Font List with Live Previews */}
      <div className="max-h-96 space-y-1 overflow-y-auto rounded border border-gray-300 bg-white p-2">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading fonts...</div>
        ) : sortedFamilies.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No fonts found</div>
        ) : (
          sortedFamilies.map(({ family, category, variants }) => (
            <button
              key={family}
              onClick={() => {
                onChange(family);
                handleFontHover(family);
              }}
              onMouseEnter={() => handleFontHover(family)}
              className={`w-full rounded px-3 py-2 text-left transition-colors ${
                value === family
                  ? 'bg-blue-100 text-blue-900 font-medium'
                  : 'bg-white text-gray-900 hover:bg-gray-100'
              }`}
              style={{
                fontFamily: hoveredFont === family || value === family ? family : 'inherit',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">{family}</span>
                <span className="text-xs text-gray-500">
                  {variants.length} variant{variants.length > 1 ? 's' : ''}
                </span>
              </div>
              {(hoveredFont === family || value === family) && (
                <div className="mt-1 text-xs text-gray-500">
                  The quick brown fox jumps over the lazy dog
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Upload Custom Font Button */}
      <button
        onClick={() => {
          // Open font upload modal
          console.log('Open font upload modal');
        }}
        className="w-full rounded border border-dashed border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        + Upload Custom Font
      </button>
    </div>
  );
}
```

### 3.3 Font Upload Modal (`components/PropertyPanel/FontUploadModal.tsx`)

```tsx
interface FontUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (font: Font) => void;
}

export function FontUploadModal({ isOpen, onClose, onSuccess }: FontUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fontName, setFontName] = useState('');
  const [fontFamily, setFontFamily] = useState('');
  const [fontCategory, setFontCategory] = useState('sans-serif');
  const [fontVariant, setFontVariant] = useState('regular');
  const [fontWeight, setFontWeight] = useState(400);
  const [fontStyle, setFontStyle] = useState('normal');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validExtensions = ['.woff2', '.woff', '.ttf', '.otf'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setError('Please select a valid font file (.woff2, .woff, .ttf, .otf)');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-fill font name from file name
    if (!fontName) {
      const name = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setFontName(name);
      setFontFamily(name);
    }
  };

  const handleUpload = async () => {
    if (!file || !fontName || !fontFamily) {
      setError('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const font = await fontService.uploadFont(file, {
        fontName,
        fontFamily,
        fontCategory,
        fontVariant,
        fontWeight,
        fontStyle,
      });

      onSuccess(font);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload font');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Upload Custom Font</h3>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font File *</label>
            <input
              type="file"
              accept=".woff2,.woff,.ttf,.otf"
              onChange={handleFileChange}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              Supported formats: .woff2 (recommended), .woff, .ttf, .otf
            </p>
          </div>

          {/* Font Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font Name *</label>
            <input
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="e.g., My Custom Font Bold"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Font Family *</label>
            <input
              type="text"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              placeholder="e.g., MyCustomFont"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <p className="mt-1 text-xs text-gray-500">
              CSS font-family name (no spaces recommended)
            </p>
          </div>

          {/* Category, Variant, Weight, Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={fontCategory}
                onChange={(e) => setFontCategory(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-Serif</option>
                <option value="display">Display</option>
                <option value="handwriting">Handwriting</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Variant</label>
              <select
                value={fontVariant}
                onChange={(e) => setFontVariant(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="regular">Regular</option>
                <option value="bold">Bold</option>
                <option value="italic">Italic</option>
                <option value="bold-italic">Bold Italic</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Weight</label>
              <input
                type="number"
                value={fontWeight}
                onChange={(e) => setFontWeight(parseInt(e.target.value))}
                min={100}
                max={900}
                step={100}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Style</label>
              <select
                value={fontStyle}
                onChange={(e) => setFontStyle(e.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading || !file || !fontName || !fontFamily}
            className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload Font'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 Update TextProperties.tsx

Replace lines 65-78 (font family select) with:

```tsx
import { FontSelector } from './FontSelector';

// ... inside component

<div>
  <label className="mb-1 block text-sm font-medium text-gray-700">Font Family</label>
  <FontSelector
    value={element.fontFamily}
    onChange={(fontFamily) => handleChange({ fontFamily })}
  />
</div>
```

---

## 4. Integration Points

### 4.1 Server Startup

In `api-server/src/server.ts`:

```typescript
import fontRoutes from './features/font-management/routes/fontRoutes';

// Register routes
server.register(fontRoutes);

// After server starts
server.listen({ port: 7400, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }

  console.log(`Server listening on ${address}`);

  // Load Google Fonts in background
  loadGoogleFonts(fontService).catch(err => {
    console.error('[Startup] Failed to load Google Fonts:', err);
  });
});
```

### 4.2 Docker Configuration

**SeaweedFS Volume:**

Ensure SeaweedFS has a `fonts` bucket or directory:

```yaml
# docker-compose.dev.yml
services:
  seaweedfs:
    # ... existing config
    volumes:
      - seaweedfs-data:/data
```

### 4.3 Environment Variables

Add to `.env`:

```bash
# Font Management
SEAWEEDFS_FONTS_BUCKET=fonts
GOOGLE_FONTS_API_URL=https://fonts.googleapis.com
```

---

## 5. Implementation Steps

### Phase 1: Backend Foundation
1. ✅ Create feature directory structure
2. ✅ Create Cassandra schema (`cassandra/schema.cql`)
3. ✅ Create types (`types/index.ts`)
4. ✅ Implement FontService (`services/fontService.ts`)
5. ✅ Implement FontController (`controllers/fontController.ts`)
6. ✅ Create routes (`routes/fontRoutes.ts`)
7. ✅ Register routes in server

### Phase 2: Google Fonts Integration
8. ✅ Create startup script (`startup/loadGoogleFonts.ts`)
9. ✅ Integrate with server startup
10. ✅ Test auto-loading (check logs for success/failures)

### Phase 3: Frontend Foundation
11. ✅ Create frontend font service (`services/fontService.ts`)
12. ✅ Create FontSelector component (`components/PropertyPanel/FontSelector.tsx`)
13. ✅ Create FontUploadModal component (`components/PropertyPanel/FontUploadModal.tsx`)
14. ✅ Update TextProperties to use FontSelector

### Phase 4: Testing
15. ✅ Test global font loading (check Cassandra for 30 fonts)
16. ✅ Test font preview in UI
17. ✅ Test custom font upload
18. ✅ Test font deletion
19. ✅ Test font file serving
20. ✅ Test canvas rendering with new fonts

### Phase 5: Polish
21. ✅ Add loading states
22. ✅ Add error handling
23. ✅ Add font search/filtering
24. ✅ Add category badges
25. ✅ Optimize font loading (lazy load on hover)

---

## 6. Success Criteria

✅ **Global Fonts:**
- 30 curated Google Fonts automatically loaded on startup
- Fonts stored in SeaweedFS with Cassandra metadata
- Fonts available to all users
- No re-download on server restart (check exists first)

✅ **User Fonts:**
- Users can upload custom .woff2/.ttf/.otf files
- User fonts only visible to the uploading user
- Users can delete their own fonts
- Font files properly cleaned up from SeaweedFS

✅ **Font Selector UI:**
- Search functionality
- Category filtering
- Scope toggle (all/global/user)
- Live font preview (lazy loaded)
- Shows selected font at top
- Upload custom font button

✅ **Font Rendering:**
- Fonts dynamically loaded via @font-face
- Fonts work in canvas rendering
- Fonts work in export (PNG/JPG/SVG)
- Multiple weights/styles supported

✅ **Performance:**
- Fonts lazy loaded (not all at once)
- Font files cached by browser
- SeaweedFS serves files efficiently
- No blocking on server startup

✅ **Security:**
- User fonts isolated (partition by user_id)
- Font file endpoints public (needed for @font-face)
- Upload restricted to authenticated users
- File type validation on upload

---

## 7. Technical Notes

### Google Fonts API Integration

**CSS API:**
```
https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap
```

Returns CSS with @font-face rules:
```css
@font-face {
  font-family: 'Montserrat';
  src: url(https://fonts.gstatic.com/s/montserrat/v25/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXp-p7K4KLg.woff2) format('woff2');
  font-weight: 400;
  font-style: normal;
}
```

**Process:**
1. Fetch CSS from Google Fonts API
2. Parse CSS to extract .woff2 URLs
3. Download .woff2 files
4. Upload to SeaweedFS
5. Store metadata in Cassandra

### Font File Formats

**Priority:**
1. `.woff2` (best compression, modern browsers)
2. `.woff` (fallback for older browsers)
3. `.ttf` / `.otf` (fallback for very old browsers)

**Recommendation:** Only use .woff2 for new uploads to save storage.

### Cassandra Partitioning

**Global fonts:** `user_id = NULL`
- Single partition for all global fonts (~30 fonts = small)
- Fast queries: `SELECT * FROM fonts WHERE user_id = NULL`

**User fonts:** `user_id = <userId>`
- Separate partition per user
- Fast queries: `SELECT * FROM fonts WHERE user_id = ?`

**Combined query:**
```typescript
// Get all available fonts for user
const globalFonts = await cassandraClient.execute(
  'SELECT * FROM fonts WHERE user_id = NULL AND is_system_font = true'
);

const userFonts = await cassandraClient.execute(
  'SELECT * FROM fonts WHERE user_id = ? AND is_system_font = false',
  [userId]
);

return [...globalFonts.rows, ...userFonts.rows];
```

---

## 8. Future Enhancements (Not in MVP)

- [ ] Font subsetting (reduce file size by including only used characters)
- [ ] Font preview with custom text
- [ ] Font pairing suggestions
- [ ] Variable fonts support
- [ ] Font licensing info display
- [ ] Bulk font upload
- [ ] Font collections/favorites
- [ ] Font usage analytics
- [ ] Font CDN integration (instead of self-hosting)
- [ ] Adobe Fonts integration (requires license)

---

## 9. Risks and Mitigation

**Risk:** Google Fonts download failures during startup
**Mitigation:**
- Catch errors per-font (don't fail all)
- Log failures for manual review
- Retry logic with exponential backoff

**Risk:** Large font files consuming storage
**Mitigation:**
- Only use .woff2 (best compression)
- Set file size limit (e.g., 500KB per file)
- Monitor SeaweedFS storage usage

**Risk:** User uploads malicious files
**Mitigation:**
- Validate file extension
- Validate MIME type
- Scan file headers
- Set file size limit
- Isolate user fonts from global fonts

**Risk:** Font rendering issues in exports
**Mitigation:**
- Test exports with each font
- Use Fabric.js font loading helpers
- Add fallback fonts in CSS

---

## 10. Timeline Estimate

**Phase 1-2 (Backend + Google Fonts):** 4-6 hours
**Phase 3 (Frontend):** 3-4 hours
**Phase 4-5 (Testing + Polish):** 2-3 hours

**Total:** 9-13 hours of development

---

## Conclusion

This font management feature will provide a professional font selection experience with:
- 30 beautiful, legally safe Google Fonts
- User custom font uploads
- Live font previews
- Efficient storage and serving
- Scalable architecture

All fonts are open-source (Google Fonts) or user-owned (custom uploads), ensuring no legal issues for commercial use.
