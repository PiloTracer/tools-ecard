/**
 * Frontend Font Service
 * Manages font loading and caching
 */

import { apiClient } from '@/shared/lib/api-client';

import { getApiBaseUrl } from '@/shared/lib/api-base-url';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { demoFontRepository } from '@/features/demo/demoFontRepository';
import type { TemplateElement, TextElement } from '../types';

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

export interface FontFamily {
  family: string;
  category: string;
  variants: Font[];
}

/** Normalize variant labels so `Regular`, `regular`, and `REGULAR` all match. */
export function normalizeFontVariant(variant: string): string {
  return variant.toLowerCase().replace(/\s+/g, '-');
}

export function variantFromTextStyle(
  fontWeight?: string | number,
  fontStyle?: string
): string {
  const weight = fontWeight === 'bold' || fontWeight === 700 || fontWeight === '700';
  const italic = fontStyle === 'italic';
  if (weight && italic) return 'bold-italic';
  if (weight) return 'bold';
  if (italic) return 'italic';
  return 'regular';
}

/**
 * Font Service - client-side font management
 */
class FontService {
  private loadedFonts: Set<string> = new Set();
  private cachedFonts: Font[] = [];

  /**
   * Fetch available fonts for the current user
   * Falls back to global fonts if authentication fails
   */
  async listFonts(scope: 'global' | 'user' | 'all' = 'all'): Promise<Font[]> {
    if (isDemoMode()) {
      this.cachedFonts = await demoFontRepository.listFonts(scope);
      return this.cachedFonts;
    }
    try {
      const response = await apiClient.get<{ fonts: Font[] }>(
        `/api/v1/fonts?scope=${scope}`
      );
      this.cachedFonts = response.fonts;
      return response.fonts;
    } catch (error: any) {
      console.error('[FontService] Error listing fonts:', error);

      // If authentication failed and we were trying to get user fonts,
      // fall back to global fonts only
      if (error.message?.includes('Unauthorized') && scope !== 'global') {
        console.warn('[FontService] Auth failed, falling back to global fonts only');
        try {
          const response = await apiClient.get<{ fonts: Font[] }>(
            `/api/v1/fonts?scope=global`
          );
          this.cachedFonts = response.fonts;
          return response.fonts;
        } catch (fallbackError) {
          console.error('[FontService] Fallback to global fonts also failed:', fallbackError);
        }
      }

      // Return empty array if all attempts fail
      return [];
    }
  }

  /**
   * Load a font dynamically by injecting @font-face
   */
  async loadFont(font: Font): Promise<void> {
    if (isDemoMode()) {
      await demoFontRepository.loadFont(font);
      return;
    }
    const cacheKey = `${font.fontFamily}-${font.fontWeight}-${font.fontStyle}`;

    if (this.loadedFonts.has(cacheKey)) {
      return; // Already loaded
    }

    const fontUrl = `${getApiBaseUrl()}/api/v1/fonts/${font.fontId}/file${
      font.userId ? `?userId=${font.userId}` : ''
    }`;

    // Browser will automatically detect format from Content-Type header
    // This supports all formats: .woff2, .woff, .ttf, .otf, .ttc
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: '${font.fontFamily}';
        src: url('${fontUrl}');
        font-weight: ${font.fontWeight};
        font-style: ${font.fontStyle};
        font-display: swap;
      }

      /* CRITICAL: Prevent browser from applying synthetic bold/italic */
      /* This ensures we only use the actual font file, not browser-generated weight */
      .canvas-container * {
        font-synthesis: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
    `;
    document.head.appendChild(style);

    this.loadedFonts.add(cacheKey);
    console.log(`[FontService] Loaded font: ${font.fontFamily} (${font.fontVariant})`);
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
    if (isDemoMode()) {
      return demoFontRepository.uploadFont(file, metadata);
    }
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const response = await fetch(`${getApiBaseUrl()}/api/v1/fonts`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload font');
    }

    const { font } = await response.json();

    // Load the uploaded font immediately
    await this.loadFont(font);

    return font;
  }

  /**
   * Delete a custom font
   */
  async deleteFont(fontId: string): Promise<void> {
    if (isDemoMode()) {
      await demoFontRepository.deleteFont(fontId);
      return;
    }
    await apiClient.delete(`/api/v1/fonts/${fontId}`);
  }

  /**
   * Get unique font families (group by font family)
   */
  getFontFamilies(fonts: Font[]): FontFamily[] {
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

  /**
   * Get cached fonts
   */
  getCachedFonts(): Font[] {
    return this.cachedFonts;
  }

  /**
   * Find a catalog entry for a text element's requested family + variant.
   * Falls back to any variant of the same family (ZIP imports may register
   * `Regular` while elements request `regular`).
   */
  resolveFont(
    fontFamily: string,
    variant: string,
    fonts: Font[] = this.cachedFonts
  ): Font | undefined {
    const norm = normalizeFontVariant(variant);
    return (
      fonts.find(
        (f) =>
          f.fontFamily === fontFamily &&
          normalizeFontVariant(f.fontVariant) === norm
      ) || fonts.find((f) => f.fontFamily === fontFamily)
    );
  }

  /**
   * Preload every font referenced by template text elements and wait for the
   * browser Font Loading API so Fabric never renders with a fallback face.
   */
  async preloadFontsForElements(elements: TemplateElement[]): Promise<void> {
    const fontKeys = new Set<string>();
    elements.forEach((element) => {
      if (element.type !== 'text') return;
      const textElement = element as TextElement;
      const variant = variantFromTextStyle(
        textElement.fontWeight,
        textElement.fontStyle
      );
      fontKeys.add(`${textElement.fontFamily || 'Arial'}:${variant}`);
    });

    if (fontKeys.size === 0) return;

    let cachedFonts = this.getCachedFonts();
    if (cachedFonts.length === 0) {
      await this.listFonts('all');
      cachedFonts = this.getCachedFonts();
    }

    const families = new Set<string>();
    const loadOne = async (fontFamily: string, variant: string) => {
      families.add(fontFamily);
      let font = this.resolveFont(fontFamily, variant, cachedFonts);
      if (!font) {
        await this.listFonts('all');
        cachedFonts = this.getCachedFonts();
        font = this.resolveFont(fontFamily, variant, cachedFonts);
      }
      if (!font) {
        console.warn(
          `[FontService] Font not found in catalog, will render with fallback: ${fontFamily} (${variant})`
        );
        return;
      }
      try {
        await this.loadFont(font);
      } catch (error) {
        console.error(
          `[FontService] Failed to preload font ${fontFamily} (${variant}):`,
          error
        );
      }
    };

    await Promise.all(
      Array.from(fontKeys).map(async (fontKey) => {
        const [fontFamily, variant] = fontKey.split(':');
        await loadOne(fontFamily, variant);
      })
    );

    const fontsApi: FontFaceSet | undefined =
      typeof document !== 'undefined' ? document.fonts : undefined;
    if (fontsApi?.load) {
      try {
        await Promise.all(
          Array.from(families).map((family) =>
            fontsApi.load(`16px "${family}"`).catch(() => {})
          )
        );
        await fontsApi.ready;
      } catch {
        /* Font Loading API unavailable — best effort */
      }
    }
  }

  /**
   * Check if a font is loaded
   */
  isFontLoaded(fontFamily: string, fontWeight: number, fontStyle: string): boolean {
    const cacheKey = `${fontFamily}-${fontWeight}-${fontStyle}`;
    return this.loadedFonts.has(cacheKey);
  }
}

// Export singleton instance
export const fontService = new FontService();
