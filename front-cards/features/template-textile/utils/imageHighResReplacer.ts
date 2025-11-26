/**
 * Image High-Resolution Replacer
 * Replaces canvas images with high-resolution versions for export
 *
 * Extracted from CanvasControls.tsx to make reusable for both on-screen and off-screen export
 */

import * as fabric from 'fabric';
import type { ImageElement, TemplateElement } from '../types';

/**
 * Replace images in canvas with high-resolution versions
 * Returns original objects for restoration after export
 */
export async function replaceImagesWithHighRes(
  canvas: fabric.Canvas,
  elements: TemplateElement[]
): Promise<fabric.Object[]> {
  const originalObjects: fabric.Object[] = [];
  const canvasObjects = canvas.getObjects();

  // Process each image element
  for (const element of elements) {
    if (element.type !== 'image') continue;

    const imgElement = element as ImageElement;
    const fabricObj = canvasObjects.find((obj: any) => obj.elementId === element.id);

    if (!fabricObj || (fabricObj.type !== 'image' && fabricObj.type !== 'Image')) continue;

    // Save original object for restoration
    originalObjects.push(fabricObj);

    // Load high-res version
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgElement.imageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      // Calculate dimensions at full resolution
      const renderWidth = img.naturalWidth || img.width;
      const renderHeight = img.naturalHeight || img.height;

      // Get current display dimensions from the Fabric object
      const currentDisplayWidth = ((fabricObj as any).width || 100) * ((fabricObj as any).scaleX || 1);
      const currentDisplayHeight = ((fabricObj as any).height || 100) * ((fabricObj as any).scaleY || 1);

      // Calculate scale to fit (separate X/Y to preserve distortion)
      const scaleToFitX = currentDisplayWidth / renderWidth;
      const scaleToFitY = currentDisplayHeight / renderHeight;

      // Create high-res Fabric image
      const highResImage = new fabric.Image(img, {
        left: fabricObj.left,
        top: fabricObj.top,
        scaleX: scaleToFitX,
        scaleY: scaleToFitY,
        angle: fabricObj.angle,
        opacity: fabricObj.opacity,
        originX: fabricObj.originX,
        originY: fabricObj.originY,
        excludeFromExport: (fabricObj as any).excludeFromExport || false
      });

      // Store metadata
      (highResImage as any)._originalImageUrl = imgElement.imageUrl;
      (highResImage as any).elementId = element.id;

      // Replace in canvas
      canvas.remove(fabricObj);
      canvas.add(highResImage);
    } catch (error) {
      console.error(`Failed to load high-res image for element ${element.id}:`, error);
      // Keep original object if high-res fails
    }
  }

  canvas.renderAll();
  return originalObjects;
}

/**
 * Restore original images after export
 */
export function restoreOriginalImages(
  canvas: fabric.Canvas,
  originalObjects: fabric.Object[]
): void {
  // Remove high-res replacements
  const currentObjects = canvas.getObjects();
  const highResObjects = currentObjects.filter((obj: any) => obj._originalImageUrl);
  highResObjects.forEach(obj => canvas.remove(obj));

  // Restore originals
  originalObjects.forEach(obj => canvas.add(obj));
  canvas.renderAll();
}
