/**
 * Demo font repository — metadata in localStorage, files in IndexedDB
 */

import type { Font } from '@/features/template-textile/services/fontService';
import { DEMO_USER } from './demoConstants';
import { demoStore, newDemoId } from './demoStore';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const demoFontRepository = {
  async listFonts(scope: 'global' | 'user' | 'all' = 'all'): Promise<Font[]> {
    void scope;
    return demoStore.getFontsMeta<Font>();
  },

  async loadFont(font: Font): Promise<void> {
    const blob = await demoStore.getBlob(`font:${font.fontId}`);
    if (!blob) return;
    const cacheKey = `${font.fontFamily}-${font.fontWeight}-${font.fontStyle}`;
    const styleId = `demo-font-${cacheKey}`;
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @font-face {
        font-family: '${font.fontFamily}';
        src: url('${blob.data}');
        font-weight: ${font.fontWeight};
        font-style: ${font.fontStyle};
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
  },

  async uploadFont(
    file: File,
    metadata: {
      fontName: string;
      fontFamily: string;
      fontCategory: string;
      fontVariant: string;
      fontWeight: number;
      fontStyle: string;
    }
  ): Promise<Font> {
    const fontId = newDemoId('font');
    const dataUrl = await fileToDataUrl(file);
    await demoStore.putBlob(`font:${fontId}`, dataUrl, file.type || 'font/ttf');
    const font: Font = {
      fontId,
      userId: DEMO_USER.id,
      fontName: metadata.fontName,
      fontFamily: metadata.fontFamily,
      fontCategory: metadata.fontCategory,
      fontVariant: metadata.fontVariant,
      fontWeight: metadata.fontWeight,
      fontStyle: metadata.fontStyle,
      isSystemFont: false,
    };
    const fonts = demoStore.getFontsMeta<Font>();
    fonts.push(font);
    demoStore.setFontsMeta(fonts);
    await this.loadFont(font);
    return font;
  },

  async deleteFont(fontId: string): Promise<void> {
    demoStore.setFontsMeta(demoStore.getFontsMeta<Font>().filter((f) => f.fontId !== fontId));
    try {
      await demoStore.deleteBlob(`font:${fontId}`);
    } catch {
      /* ignore */
    }
  },
};
