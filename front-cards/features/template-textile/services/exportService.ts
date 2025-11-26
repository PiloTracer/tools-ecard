/**
 * Export Service
 * Off-screen canvas export functionality - export templates without opening them
 *
 * Enables:
 * - Export templates that are not currently open
 * - Batch export multiple templates
 * - Background export operations
 */

import * as fabric from 'fabric';
import { templateService } from './templateService';
import { recreateElements } from './canvasRenderer';
import { replaceImagesWithHighRes } from '../utils/imageHighResReplacer';
import { generateVCardFromElements } from './vcardGenerator';
import type { Template, QRElement } from '../types';

export interface ExportOptions {
  format: 'png' | 'jpg';
  quality?: number;              // 0-1, for JPG (default: 1.0)
  width?: number;                // Override export width
  height?: number;               // Override export height (maintains aspect ratio)
  backgroundColor?: string;      // Canvas background (default: template bg or white)
  onProgress?: (step: string, progress: number) => void;
}

export interface ExportResult {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

/**
 * Export a template by ID without opening it
 */
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

/**
 * Export a template object to image
 */
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

  // Auto-generate QR codes before export (if QR elements exist)
  let templateToExport = template;
  const qrElements = template.elements?.filter(el => el.type === 'qr') || [];
  if (qrElements.length > 0) {
    console.log('[Export] Auto-generating vCard for QR codes...');
    const vCardData = generateVCardFromElements(template.elements || []);
    console.log('[Export] Generated vCard:', vCardData.substring(0, 100) + '...');

    // Clone template and update QR elements
    templateToExport = {
      ...template,
      elements: template.elements?.map(element => {
        if (element.type === 'qr') {
          return {
            ...element,
            data: vCardData,
            qrType: 'vcard' as const,
          } as QRElement;
        }
        return element;
      }) || []
    };

    console.log(`[Export] Updated ${qrElements.length} QR code(s) with vCard data`);
  }

  // Calculate dimensions
  const canvasWidth = templateToExport.width || templateToExport.canvasWidth || 1200;
  const canvasHeight = templateToExport.height || templateToExport.canvasHeight || 600;

  const exportWidth = width || templateToExport.exportWidth || canvasWidth;
  const exportHeight = height || Math.round(exportWidth * canvasHeight / canvasWidth);
  const multiplier = exportWidth / canvasWidth;

  // Validate multiplier (Fabric.js limit)
  if (multiplier * canvasWidth > 10000 || multiplier * canvasHeight > 10000) {
    throw new Error(`Export dimensions exceed maximum (10000px). Requested: ${Math.round(multiplier * canvasWidth)}x${Math.round(multiplier * canvasHeight)}`);
  }

  // Step 1: Create off-screen canvas
  onProgress?.('Creating canvas', 0.2);
  const offscreenCanvas = createOffscreenCanvas(
    canvasWidth,
    canvasHeight,
    backgroundColor || templateToExport.backgroundColor || '#ffffff'
  );

  let blobUrls: string[] = [];

  try {
    // Step 2: Recreate elements
    onProgress?.('Recreating elements', 0.3);
    blobUrls = await recreateElements(
      offscreenCanvas,
      templateToExport.elements || [],
      {
        loadImages: true,
        onProgress: (current, total) => {
          const progress = 0.3 + (0.4 * (current / total));
          onProgress?.('Loading elements', progress);
        }
      }
    );

    // Step 3: Replace images with high-res versions
    onProgress?.('Preparing high-resolution images', 0.75);
    await replaceImagesWithHighRes(offscreenCanvas, template.elements || []);

    // Step 4: Remove excludeFromExport objects
    removeExcludedObjects(offscreenCanvas);

    // Step 5: Export
    onProgress?.('Exporting image', 0.9);
    const fabricFormat = format === 'jpg' ? 'jpeg' : 'png';
    const dataUrl = offscreenCanvas.toDataURL({
      format: fabricFormat,
      quality: format === 'jpg' ? quality : 1.0,
      multiplier: multiplier
    });

    // Clean up blob URLs
    blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    onProgress?.('Complete', 1.0);

    return {
      dataUrl,
      width: exportWidth,
      height: exportHeight,
      format,
      sizeBytes: dataUrl.length
    };
  } catch (error) {
    // Clean up blob URLs on error
    blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    throw error;
  } finally {
    // Always clean up canvas
    disposeOffscreenCanvas(offscreenCanvas);
  }
}

/**
 * Batch export multiple templates
 */
export async function batchExportTemplates(
  templateIds: string[],
  options: ExportOptions,
  onBatchProgress?: (current: number, total: number, templateId: string) => void
): Promise<Map<string, ExportResult | Error>> {
  const results = new Map<string, ExportResult | Error>();

  for (let i = 0; i < templateIds.length; i++) {
    const templateId = templateIds[i];
    onBatchProgress?.(i + 1, templateIds.length, templateId);

    try {
      const result = await exportTemplateById(templateId, {
        ...options,
        onProgress: undefined // Don't pass individual progress for batch
      });
      results.set(templateId, result);
    } catch (error) {
      console.error(`Failed to export template ${templateId}:`, error);
      results.set(templateId, error as Error);
      // Continue with next template
    }
  }

  return results;
}

/**
 * Create an off-screen Fabric canvas
 */
function createOffscreenCanvas(
  width: number,
  height: number,
  backgroundColor: string
): fabric.Canvas {
  // Create invisible canvas element
  const canvasElement = document.createElement('canvas');
  canvasElement.width = width;
  canvasElement.height = height;
  canvasElement.style.position = 'absolute';
  canvasElement.style.left = '-9999px';
  canvasElement.style.top = '-9999px';
  canvasElement.style.pointerEvents = 'none';

  // Append to body (required for Fabric.js to work properly)
  document.body.appendChild(canvasElement);

  // Create Fabric canvas
  const fabricCanvas = new fabric.Canvas(canvasElement, {
    width,
    height,
    backgroundColor: backgroundColor,
    renderOnAddRemove: false, // Performance: manual render control
    skipTargetFind: true,     // Performance: no event handling needed
    selection: false,          // Performance: no selection overlay
    interactive: false         // Performance: no interactivity
  });

  return fabricCanvas;
}

/**
 * Dispose of off-screen canvas and clean up DOM
 */
function disposeOffscreenCanvas(canvas: fabric.Canvas): void {
  try {
    // Get canvas element before disposal
    const canvasElement = canvas.getElement();

    // Dispose Fabric canvas
    canvas.dispose();

    // Remove from DOM
    if (canvasElement && canvasElement.parentNode) {
      canvasElement.parentNode.removeChild(canvasElement);
    }
  } catch (error) {
    console.error('Error disposing off-screen canvas:', error);
  }
}

/**
 * Remove objects marked as excludeFromExport
 */
function removeExcludedObjects(canvas: fabric.Canvas): void {
  const objects = canvas.getObjects();
  const excludedObjects = objects.filter((obj: any) => obj.excludeFromExport === true);
  excludedObjects.forEach(obj => canvas.remove(obj));
}

/**
 * Helper: Download data URL as file
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper: Estimate file size from data URL
 */
export function estimateFileSizeKB(dataUrl: string): number {
  // Base64 encoding adds ~33% overhead
  const base64Length = dataUrl.split(',')[1]?.length || 0;
  const bytes = (base64Length * 3) / 4;
  return Math.round(bytes / 1024);
}
