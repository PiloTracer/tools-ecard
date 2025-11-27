/**
 * Frontend Font Service
 * Manages font loading and caching
 */

import { apiClient } from '@/shared/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

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

/**
 * Font Service - client-side font management
 */
class FontService {
  private loadedFonts: Set<string> = new Set();
  private cachedFonts: Font[] = [];

  /**
   * Fetch available fonts for the current user
   */
  async listFonts(scope: 'global' | 'user' | 'all' = 'all'): Promise<Font[]> {
    try {
      const response = await apiClient.get<{ fonts: Font[] }>(
        `/api/v1/fonts?scope=${scope}`
      );
      this.cachedFonts = response.fonts;
      return response.fonts;
    } catch (error) {
      console.error('[FontService] Error listing fonts:', error);
      return [];
    }
  }

  /**
   * Load a font dynamically by injecting @font-face
   */
  async loadFont(font: Font): Promise<void> {
    const cacheKey = `${font.fontFamily}-${font.fontWeight}-${font.fontStyle}`;

    if (this.loadedFonts.has(cacheKey)) {
      return; // Already loaded
    }

    const fontUrl = `${API_URL}/api/v1/fonts/${font.fontId}/file${
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
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const response = await fetch(`${API_URL}/api/v1/fonts`, {
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
   * Check if a font is loaded
   */
  isFontLoaded(fontFamily: string, fontWeight: number, fontStyle: string): boolean {
    const cacheKey = `${fontFamily}-${fontWeight}-${fontStyle}`;
    return this.loadedFonts.has(cacheKey);
  }
}

// Export singleton instance
export const fontService = new FontService();
