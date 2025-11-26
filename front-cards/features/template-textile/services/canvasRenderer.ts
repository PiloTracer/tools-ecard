/**
 * Canvas Renderer Service
 * Reusable element-to-Fabric-object conversion for both on-screen and off-screen rendering
 *
 * Extracted from DesignCanvas.tsx to enable off-screen export functionality
 */

import * as fabric from 'fabric';
import type { TemplateElement, TextElement, ImageElement, ShapeElement, QRElement } from '../types';
import { createMultiColorText } from '../utils/multiColorText';
import QRCode from 'qrcode';

export interface CanvasRendererOptions {
  loadImages?: boolean;           // Default: true - load images from URLs
  onProgress?: (current: number, total: number) => void;
}

/**
 * Recreate all elements on a Fabric canvas from template data
 * Returns array of blob URLs that need to be cleaned up by caller
 */
export async function recreateElements(
  canvas: fabric.Canvas,
  elements: TemplateElement[],
  options: CanvasRendererOptions = {}
): Promise<string[]> {
  const { loadImages = true, onProgress } = options;
  const blobUrls: string[] = [];

  // Clear existing objects
  canvas.clear();

  // Track loading images to prevent duplicates
  const loadingImages = new Set<string>();

  try {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      // Progress callback
      onProgress?.(i + 1, elements.length);

      // Create Fabric object
      const fabricObject = await createElement(element, loadImages, blobUrls, loadingImages);

      if (fabricObject) {
        // Store element ID for reference
        (fabricObject as any).elementId = element.id;
        canvas.add(fabricObject);
      }
    }

    canvas.renderAll();
    return blobUrls;
  } catch (error) {
    // Clean up blob URLs on error
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
}

/**
 * Create a Fabric object from a template element
 */
async function createElement(
  element: TemplateElement,
  loadImages: boolean,
  blobUrls: string[],
  loadingImages: Set<string>
): Promise<fabric.Object | null> {
  switch (element.type) {
    case 'text':
      return createTextElement(element as TextElement);

    case 'image':
      if (loadImages) {
        return await createImageElement(element as ImageElement, blobUrls, loadingImages);
      } else {
        return createImagePlaceholder(element as ImageElement);
      }

    case 'shape':
      return createShapeElement(element as ShapeElement);

    case 'qr':
      return await createQRElement(element as QRElement);

    default:
      console.warn('Unknown element type:', (element as any).type);
      return null;
  }
}

/**
 * Create text element (single-color or multi-color)
 */
function createTextElement(element: TextElement): fabric.Object {
  // Check if multi-color text
  const hasMultipleColors = element.colors && element.colors.length > 1;

  if (hasMultipleColors) {
    // Use multi-color text group
    return createMultiColorText(element);
  } else {
    // Standard single-color text
    return new fabric.IText(element.text || 'Text', {
      left: element.x,
      top: element.y,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fill: element.color || element.colors?.[0] || '#000000',
      fontWeight: element.fontWeight || 'normal',
      fontStyle: element.fontStyle || 'normal',
      underline: element.underline || false,
      stroke: element.stroke || '',
      strokeWidth: element.strokeWidth || 0,
      textAlign: element.textAlign || 'left',
      angle: element.rotation || 0,
      opacity: element.opacity || 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false,
      excludeFromExport: element.excludeFromExport || false,
    });
  }
}

/**
 * Create image element with blob URL conversion for CORS safety
 */
async function createImageElement(
  element: ImageElement,
  blobUrls: string[],
  loadingImages: Set<string>
): Promise<fabric.Object> {
  if (!element.imageUrl) {
    return createImagePlaceholder(element);
  }

  // Prevent duplicate loading
  if (loadingImages.has(element.id)) {
    return createImagePlaceholder(element);
  }

  loadingImages.add(element.id);

  try {
    // Convert to blob URL to avoid CORS tainting
    let safeUrl = element.imageUrl;
    let blobUrl: string | null = null;

    // Only convert HTTP URLs to blob URLs (data URLs are safe)
    if (!element.imageUrl.startsWith('data:')) {
      try {
        const response = await fetch(element.imageUrl);
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl); // Track for cleanup
        safeUrl = blobUrl;
      } catch (err) {
        console.warn('Failed to convert URL to blob URL:', err);
        // Fall back to original URL
      }
    }

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = safeUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    // Get full resolution dimensions
    const fullResWidth = img.naturalWidth || img.width;
    const fullResHeight = img.naturalHeight || img.height;

    // Create fabric image with full resolution
    const fabricImg = new fabric.Image(img, {
      left: element.x,
      top: element.y,
      angle: element.rotation || 0,
      opacity: element.opacity || 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      excludeFromExport: element.excludeFromExport || false,
    });

    // Calculate scale to fit box while keeping full resolution
    const scaleX = element.width / fullResWidth;
    const scaleY = element.height / fullResHeight;

    fabricImg.set({
      scaleX: scaleX,
      scaleY: scaleY,
    });

    // Store original URL for high-res export
    (fabricImg as any)._originalImageUrl = element.imageUrl;

    loadingImages.delete(element.id);
    return fabricImg;
  } catch (error) {
    console.error('Failed to load image:', element.imageUrl, error);
    loadingImages.delete(element.id);
    return createImagePlaceholder(element);
  }
}

/**
 * Create placeholder for image (when loading fails or loadImages=false)
 */
function createImagePlaceholder(element: ImageElement): fabric.Object {
  return new fabric.Rect({
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    fill: '#334155',
    stroke: '#64748b',
    strokeWidth: 2,
    angle: element.rotation || 0,
    opacity: element.opacity || 1,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    excludeFromExport: element.excludeFromExport || false,
  });
}

/**
 * Create shape element
 */
function createShapeElement(element: ShapeElement): fabric.Object {
  const baseProps = {
    left: element.x,
    top: element.y,
    fill: element.fill || '#3b82f6',
    stroke: element.stroke || '#1e40af',
    strokeWidth: element.strokeWidth || 2,
    angle: element.rotation || 0,
    opacity: element.opacity || 1,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    excludeFromExport: element.excludeFromExport || false,
  };

  switch (element.shapeType) {
    case 'rectangle':
      return new fabric.Rect({
        ...baseProps,
        width: element.width || 100,
        height: element.height || 100,
        rx: element.rx || 0,
        ry: element.ry || 0,
      });

    case 'circle':
      const radius = Math.min(element.width || 100, element.height || 100) / 2;
      return new fabric.Circle({
        ...baseProps,
        radius: radius,
      });

    case 'ellipse':
      return new fabric.Ellipse({
        ...baseProps,
        rx: (element.width || 100) / 2,
        ry: (element.height || 100) / 2,
      });

    case 'line':
      const x2 = element.x + (element.width || 100);
      const y2 = element.y + (element.height || 0);
      return new fabric.Line([element.x, element.y, x2, y2], {
        stroke: element.stroke || '#1e40af',
        strokeWidth: element.strokeWidth || 2,
        angle: element.rotation || 0,
        opacity: element.opacity || 1,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        excludeFromExport: element.excludeFromExport || false,
      });

    default:
      // Default to rectangle
      return new fabric.Rect({
        ...baseProps,
        width: element.width || 100,
        height: element.height || 100,
      });
  }
}

/**
 * Create QR code element
 */
async function createQRElement(element: QRElement): Promise<fabric.Object> {
  // Use width/height if available, fallback to size for backward compatibility
  const qrWidth = element.width || element.size;
  const qrHeight = element.height || element.size;

  try {
    // Generate QR code data URL
    const qrDataUrl = await QRCode.toDataURL(element.data || 'https://example.com', {
      width: qrWidth * 2, // 2x for better quality
      margin: 1,
      color: {
        dark: element.colorDark || '#000000',
        light: element.colorLight || '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    // Load QR code image
    const img = new Image();
    img.src = qrDataUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    // Create fabric image
    const fabricImg = new fabric.Image(img, {
      left: element.x,
      top: element.y,
      width: img.width,
      height: img.height,
      scaleX: qrWidth / img.width,
      scaleY: qrHeight / img.height,
      angle: element.rotation || 0,
      opacity: element.opacity || 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      excludeFromExport: element.excludeFromExport || false,
    });

    return fabricImg;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Return placeholder on error
    return new fabric.Rect({
      left: element.x,
      top: element.y,
      width: qrWidth,
      height: qrHeight,
      fill: '#e5e7eb',
      stroke: '#9ca3af',
      strokeWidth: 2,
      angle: element.rotation || 0,
      opacity: element.opacity || 1,
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      excludeFromExport: element.excludeFromExport || false,
    });
  }
}
