/**
 * Template Package Service
 * Handles export/import of complete template packages (ZIP format)
 * Includes: template JSON, images, and custom fonts
 */

import JSZip from 'jszip';
import { Template, ImageElement, TextElement, TemplateElement } from '../types';
import { fontService } from './fontService';
import { apiClient } from '@/shared/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

interface PackageMetadata {
  version: '1.0';
  exportDate: string;
  customFonts: Array<{
    fontFamily: string;
    fontId: string;
    filename: string;
  }>;
  images: Array<{
    elementId: string;
    filename: string;
    originalUrl: string;
  }>;
}

export class TemplatePackageService {
  /**
   * Export template as ZIP package with all resources
   */
  async exportPackage(template: Template): Promise<Blob> {
    console.log('[PackageExport] Starting export for template:', template.name);

    const zip = new JSZip();
    const metadata: PackageMetadata = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      customFonts: [],
      images: []
    };

    // 1. Collect and bundle images
    const imageElements = template.elements.filter(el => el.type === 'image') as ImageElement[];
    console.log(`[PackageExport] Found ${imageElements.length} images to bundle`);

    for (let i = 0; i < imageElements.length; i++) {
      const imgElement = imageElements[i];
      try {
        // Fetch image data
        const imageData = await this.fetchImageData(imgElement.imageUrl);
        const filename = `image-${i + 1}.${this.getImageExtension(imageData.type)}`;

        // Add to ZIP
        zip.file(`images/${filename}`, imageData.blob);

        // Track metadata
        metadata.images.push({
          elementId: imgElement.id,
          filename: `images/${filename}`,
          originalUrl: imgElement.imageUrl
        });

        console.log(`[PackageExport] Bundled image: ${filename}`);
      } catch (error) {
        console.error(`[PackageExport] Failed to fetch image for element ${imgElement.id}:`, error);
        // Continue with other images
      }
    }

    // 2. Collect and bundle custom fonts
    const customFonts = await this.collectCustomFonts(template.elements);
    console.log(`[PackageExport] Found ${customFonts.size} custom fonts to bundle`);

    for (const [fontFamily, fontData] of customFonts.entries()) {
      try {
        // Fetch font file from server
        const fontBlob = await this.fetchFontFile(fontData.fontId);
        const filename = `${this.sanitizeFilename(fontFamily)}.woff2`;

        // Add to ZIP
        zip.file(`fonts/${filename}`, fontBlob);

        // Track metadata
        metadata.customFonts.push({
          fontFamily,
          fontId: fontData.fontId,
          filename: `fonts/${filename}`
        });

        console.log(`[PackageExport] Bundled font: ${filename}`);
      } catch (error) {
        console.error(`[PackageExport] Failed to fetch font ${fontFamily}:`, error);
        // Continue with other fonts
      }
    }

    // 3. Create modified template JSON with relative paths
    const packagedTemplate = this.createPackagedTemplate(template, metadata);
    zip.file('template.json', JSON.stringify(packagedTemplate, null, 2));

    // 4. Add metadata file
    zip.file('package.json', JSON.stringify(metadata, null, 2));

    // 5. Generate ZIP blob
    console.log('[PackageExport] Generating ZIP file...');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    console.log('[PackageExport] Export complete!', {
      images: metadata.images.length,
      fonts: metadata.customFonts.length,
      size: `${(zipBlob.size / 1024).toFixed(2)} KB`
    });

    return zipBlob;
  }

  /**
   * Import template from ZIP package
   */
  async importPackage(zipFile: File): Promise<Template> {
    console.log('[PackageImport] Starting import from:', zipFile.name);

    const zip = await JSZip.loadAsync(zipFile);

    // 1. Read metadata
    const metadataFile = zip.file('package.json');
    if (!metadataFile) {
      throw new Error('Invalid package: missing package.json');
    }
    const metadata: PackageMetadata = JSON.parse(await metadataFile.async('string'));
    console.log('[PackageImport] Package metadata:', metadata);

    // 2. Read template JSON
    const templateFile = zip.file('template.json');
    if (!templateFile) {
      throw new Error('Invalid package: missing template.json');
    }
    const templateData: Template = JSON.parse(await templateFile.async('string'));

    // 3. Restore images (convert to data URLs for immediate use)
    const imageMap = new Map<string, string>();
    for (const imgMeta of metadata.images) {
      const imgFile = zip.file(imgMeta.filename);
      if (imgFile) {
        const blob = await imgFile.async('blob');
        const dataUrl = await this.blobToDataURL(blob);
        imageMap.set(imgMeta.elementId, dataUrl);
        console.log(`[PackageImport] Restored image: ${imgMeta.filename}`);
      }
    }

    // 4. Restore custom fonts (re-upload to server)
    const fontMap = new Map<string, string>(); // old fontFamily -> new fontFamily
    for (const fontMeta of metadata.customFonts) {
      const fontFile = zip.file(fontMeta.filename);
      if (fontFile) {
        try {
          const blob = await fontFile.async('blob');
          const file = new File([blob], fontMeta.filename, { type: 'font/woff2' });

          // Re-upload font to server
          const uploadedFont = await fontService.uploadFont(file, {
            fontName: fontMeta.fontFamily,
            fontFamily: fontMeta.fontFamily,
            fontCategory: 'sans-serif', // Default, could be stored in metadata
            fontVariant: 'Regular',
            fontWeight: 400,
            fontStyle: 'normal'
          });

          fontMap.set(fontMeta.fontFamily, uploadedFont.fontFamily);
          console.log(`[PackageImport] Restored font: ${fontMeta.fontFamily}`);
        } catch (error) {
          console.error(`[PackageImport] Failed to restore font ${fontMeta.fontFamily}:`, error);
          // Font will fall back to default
        }
      }
    }

    // 5. Update template with restored resources
    const restoredTemplate = this.restoreTemplateResources(templateData, imageMap, fontMap);

    // 6. Generate new ID and timestamps
    const newTemplate: Template = {
      ...restoredTemplate,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('[PackageImport] Import complete!', {
      templateName: newTemplate.name,
      imagesRestored: imageMap.size,
      fontsRestored: fontMap.size
    });

    return newTemplate;
  }

  // ============= Helper Methods =============

  /**
   * Fetch image data from URL (blob, data URL, or HTTP)
   */
  private async fetchImageData(url: string): Promise<{ blob: Blob; type: string }> {
    if (url.startsWith('data:')) {
      // Data URL - extract blob
      const response = await fetch(url);
      const blob = await response.blob();
      return { blob, type: blob.type };
    } else if (url.startsWith('blob:')) {
      // Blob URL - fetch blob
      const response = await fetch(url);
      const blob = await response.blob();
      return { blob, type: blob.type };
    } else {
      // HTTP URL - fetch from server
      const response = await fetch(url);
      const blob = await response.blob();
      return { blob, type: blob.type };
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getImageExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    return map[mimeType] || 'png';
  }

  /**
   * Collect all custom fonts used in template
   */
  private async collectCustomFonts(elements: TemplateElement[]): Promise<Map<string, { fontId: string }>> {
    const customFonts = new Map<string, { fontId: string }>();

    // Get list of all fonts from server
    const allFonts = await fontService.listFonts('user');
    const fontMap = new Map(allFonts.map(f => [f.fontFamily, f]));

    // Find custom fonts in elements
    for (const element of elements) {
      if (element.type === 'text') {
        const textEl = element as TextElement;
        const font = fontMap.get(textEl.fontFamily);

        // Only include user-uploaded fonts (not system fonts)
        if (font && !font.isSystemFont) {
          customFonts.set(textEl.fontFamily, {
            fontId: font.fontId
          });
        }
      }
    }

    return customFonts;
  }

  /**
   * Fetch font file from server
   * Includes credentials to allow access to user-uploaded fonts
   */
  private async fetchFontFile(fontId: string): Promise<Blob> {
    const url = `${API_URL}/api/v1/fonts/${fontId}/file`;
    console.log(`[PackageExport] Fetching font file from: ${url}`);

    const response = await fetch(url, {
      credentials: 'include' // Send cookies for authentication
    });

    console.log(`[PackageExport] Font file response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // Log response body for debugging
      const text = await response.text();
      console.error(`[PackageExport] Font file error response:`, text);
      throw new Error(`Failed to fetch font file: ${response.statusText}`);
    }
    return await response.blob();
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Create packaged template with relative resource paths
   */
  private createPackagedTemplate(template: Template, metadata: PackageMetadata): Template {
    const packagedElements = template.elements.map(element => {
      if (element.type === 'image') {
        const imgMeta = metadata.images.find(img => img.elementId === element.id);
        if (imgMeta) {
          // Use relative path in ZIP instead of base64 data URL
          // This drastically reduces template.json size
          const { imageUrl, ...rest } = element as ImageElement;
          return {
            ...rest,
            type: 'image' as const,
            imageUrl: imgMeta.filename // Relative path in ZIP (e.g., "images/image-1.png")
          };
        }
      }
      return element;
    });

    return {
      ...template,
      elements: packagedElements
    };
  }

  /**
   * Restore template resources after import
   */
  private restoreTemplateResources(
    template: Template,
    imageMap: Map<string, string>,
    fontMap: Map<string, string>
  ): Template {
    const restoredElements = template.elements.map(element => {
      // Restore images
      if (element.type === 'image') {
        const restoredUrl = imageMap.get(element.id);
        if (restoredUrl) {
          return {
            ...element,
            imageUrl: restoredUrl
          };
        }
      }

      // Restore fonts
      if (element.type === 'text') {
        const textEl = element as TextElement;
        const newFontFamily = fontMap.get(textEl.fontFamily);
        if (newFontFamily) {
          return {
            ...textEl,
            fontFamily: newFontFamily
          };
        }
      }

      return element;
    });

    return {
      ...template,
      elements: restoredElements
    };
  }
}

export const templatePackageService = new TemplatePackageService();
