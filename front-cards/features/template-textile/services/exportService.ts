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
  const finalBackgroundColor = backgroundColor || templateToExport.backgroundColor || '#ffffff';
  console.log('[Export] backgroundColor values:', {
    provided: backgroundColor,
    templateBg: templateToExport.backgroundColor,
    final: finalBackgroundColor
  });
  const offscreenCanvas = createOffscreenCanvas(
    canvasWidth,
    canvasHeight,
    finalBackgroundColor
  );

  let blobUrls: string[] = [];

  try {
    // Step 2: Recreate elements (this clears the canvas, so background must be added AFTER)
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

    // Step 2.5: Add background rectangle AFTER recreateElements (which clears canvas)
    onProgress?.('Adding background', 0.7);
    console.log('[Export] Creating background rectangle with color:', finalBackgroundColor);
    const backgroundRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: canvasWidth,
      height: canvasHeight,
      fill: finalBackgroundColor,
      selectable: false,
      evented: false,
      strokeWidth: 0,
    });
    (backgroundRect as any).isBackgroundRect = true; // Mark for identification
    (backgroundRect as any).excludeFromExport = false; // NEVER exclude background
    offscreenCanvas.add(backgroundRect);
    offscreenCanvas.sendObjectToBack(backgroundRect); // Ensure it's at the back
    console.log('[Export] Background rectangle added. Canvas objects:', offscreenCanvas.getObjects().length);

    // Step 3: Fit text objects within safe area (30px padding)
    onProgress?.('Fitting text to safe area', 0.72);
    fitTextToSafeArea(offscreenCanvas, 30);

    // Step 4: Replace images with high-res versions
    onProgress?.('Preparing high-resolution images', 0.75);
    await replaceImagesWithHighRes(offscreenCanvas, template.elements || []);

    // Step 5: Remove excludeFromExport objects
    removeExcludedObjects(offscreenCanvas);

    // Step 6: CRITICAL - Render canvas before export
    onProgress?.('Rendering canvas', 0.85);
    console.log('[Export] Objects on canvas before render:', offscreenCanvas.getObjects().length);
    console.log('[Export] Canvas backgroundColor:', offscreenCanvas.backgroundColor);
    console.log('[Export] First object (should be background):', offscreenCanvas.getObjects()[0]?.type, (offscreenCanvas.getObjects()[0] as any)?.fill);
    offscreenCanvas.renderAll();

    // Step 7: Export
    onProgress?.('Exporting image', 0.9);
    const fabricFormat = format === 'jpg' ? 'jpeg' : 'png';
    console.log('[Export] Exporting to format:', fabricFormat, 'with multiplier:', multiplier);
    const dataUrl = offscreenCanvas.toDataURL({
      format: fabricFormat,
      quality: format === 'jpg' ? quality : 1.0,
      multiplier: multiplier
    });
    console.log('[Export] Export complete. Data URL length:', dataUrl.length);

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
  console.log('[createOffscreenCanvas] Creating canvas with backgroundColor:', backgroundColor);

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

  // IMPORTANT: Fill canvas with background color BEFORE creating Fabric canvas
  // This ensures PNG exports have the correct background
  const ctx = canvasElement.getContext('2d');
  if (ctx) {
    console.log('[createOffscreenCanvas] Painting raw canvas with color:', backgroundColor);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

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

  // Double-check: explicitly set background color after creation
  fabricCanvas.backgroundColor = backgroundColor;
  console.log('[createOffscreenCanvas] Fabric canvas created. backgroundColor:', fabricCanvas.backgroundColor);

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
 * Fit text objects within safe area (30px padding from canvas edges)
 * Uses uniform scaling to maintain aspect ratio and readability
 */
function fitTextToSafeArea(canvas: fabric.Canvas, padding: number = 30): void {
  const canvasWidth = canvas.width || 1200;
  const canvasHeight = canvas.height || 600;
  const safeLeft = padding;
  const safeTop = padding;
  const safeRight = canvasWidth - padding;
  const safeBottom = canvasHeight - padding;

  console.log('[SafeArea] Canvas size:', canvasWidth, 'x', canvasHeight);
  console.log('[SafeArea] Safe area:', { left: safeLeft, top: safeTop, right: safeRight, bottom: safeBottom });

  const objects = canvas.getObjects();
  let adjustedCount = 0;

  objects.forEach((obj: any) => {
    // Only process text objects
    if (obj.type !== 'text' && obj.type !== 'textbox' && obj.type !== 'i-text') {
      return;
    }

    // Skip background rectangles
    if (obj.isBackgroundRect) {
      return;
    }

    // Get bounding box in absolute coordinates
    const bounds = obj.getBoundingRect(true);

    // Check if text exceeds safe area
    const exceedsLeft = bounds.left < safeLeft;
    const exceedsTop = bounds.top < safeTop;
    const exceedsRight = (bounds.left + bounds.width) > safeRight;
    const exceedsBottom = (bounds.top + bounds.height) > safeBottom;

    if (exceedsLeft || exceedsTop || exceedsRight || exceedsBottom) {
      console.log('[SafeArea] Text exceeds safe area:', {
        text: obj.text?.substring(0, 50),
        bounds,
        exceedsLeft,
        exceedsTop,
        exceedsRight,
        exceedsBottom
      });

      // Calculate how much to scale down to fit
      let scaleFactorX = 1.0;
      let scaleFactorY = 1.0;

      // If exceeds right, calculate how much to shrink width
      if (exceedsRight) {
        const overhang = (bounds.left + bounds.width) - safeRight;
        const neededWidth = bounds.width - overhang;
        scaleFactorX = neededWidth / bounds.width;
        console.log('[SafeArea] Right overhang:', overhang, 'scaleFactorX:', scaleFactorX);
      }

      // If exceeds left, need to fit from safe left
      if (exceedsLeft) {
        const availableFromSafeLeft = safeRight - safeLeft;
        scaleFactorX = Math.min(scaleFactorX, availableFromSafeLeft / bounds.width);
        console.log('[SafeArea] Left overhang, scaleFactorX:', scaleFactorX);
      }

      // If exceeds bottom, calculate how much to shrink height
      if (exceedsBottom) {
        const overhang = (bounds.top + bounds.height) - safeBottom;
        const neededHeight = bounds.height - overhang;
        scaleFactorY = neededHeight / bounds.height;
        console.log('[SafeArea] Bottom overhang:', overhang, 'scaleFactorY:', scaleFactorY);
      }

      // If exceeds top, need to fit from safe top
      if (exceedsTop) {
        const availableFromSafeTop = safeBottom - safeTop;
        scaleFactorY = Math.min(scaleFactorY, availableFromSafeTop / bounds.height);
        console.log('[SafeArea] Top overhang, scaleFactorY:', scaleFactorY);
      }

      // Use UNIFORM scaling - take the smaller of the two factors
      const uniformScale = Math.min(scaleFactorX, scaleFactorY);

      // Never scale up (max 1.0), and don't go below 50% (min 0.5)
      const MIN_SCALE = 0.5;
      const MAX_SCALE = 1.0;
      const finalScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, uniformScale));

      // Get current scale
      const currentScaleX = obj.scaleX || 1;
      const currentScaleY = obj.scaleY || 1;

      // Apply uniform scale to maintain aspect ratio
      obj.scaleX = currentScaleX * finalScale;
      obj.scaleY = currentScaleY * finalScale;

      console.log('[SafeArea] Scaled text uniformly:', {
        text: obj.text?.substring(0, 50),
        currentScale: { x: currentScaleX, y: currentScaleY },
        uniformScale,
        finalScale,
        newScale: { x: obj.scaleX, y: obj.scaleY }
      });

      adjustedCount++;
    }
  });

  if (adjustedCount > 0) {
    console.log(`[SafeArea] Adjusted ${adjustedCount} text object(s) to fit within safe area`);
    canvas.renderAll();
  } else {
    console.log('[SafeArea] All text objects already fit within safe area');
  }
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
