import * as fabric from 'fabric';
import type { TextElement } from '../types';

/**
 * Creates a fabric group that renders text with per-word colors
 */
export function createMultiColorText(element: TextElement): fabric.Group {
  const words = element.text.trim().split(/\s+/);
  const textObjects: fabric.Text[] = [];

  // Get colors array (use single color as fallback)
  const colors = element.colors || (element.color ? [element.color] : ['#000000']);

  let currentX = 0;
  const spaceWidth = getSpaceWidth(element.fontFamily, element.fontSize);

  // CRITICAL: Convert 'bold' to 700 to prevent double-bold with custom fonts
  const fontWeight = element.fontWeight === 'bold' ? 700 : (element.fontWeight === 'normal' ? 400 : element.fontWeight || 400);

  // Create a text object for each word with its corresponding color
  words.forEach((word, index) => {
    // Determine which color to use (last color applies to remaining words)
    const colorIndex = Math.min(index, colors.length - 1);
    const color = colors[colorIndex];

    const textObj = new fabric.Text(word, {
      left: currentX,
      top: 0,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fill: color,
      fontWeight: fontWeight,
      fontStyle: element.fontStyle || 'normal',
      underline: element.underline || false,
      stroke: element.stroke || '',
      strokeWidth: element.strokeWidth || 0,
      textAlign: element.textAlign || 'left',
      selectable: false,
      evented: false,
    });

    textObjects.push(textObj);

    // Update position for next word
    currentX += textObj.width! + spaceWidth;
  });

  // Create a group from all text objects
  const group = new fabric.Group(textObjects, {
    left: element.x,
    top: element.y,
    angle: element.rotation || 0,
    opacity: element.opacity || 1,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockScalingX: false,
    lockScalingY: false,
    lockRotation: false,
    subTargetCheck: false, // Treat as single object
    excludeFromExport: element.excludeFromExport || false,
  });

  // Store element metadata on the group
  (group as any).elementId = element.id;
  (group as any).isMultiColorText = true;
  (group as any).originalElement = element;

  return group;
}

/**
 * Calculates the width of a space character for the given font
 */
function getSpaceWidth(fontFamily: string, fontSize: number): number {
  // Create a temporary canvas to measure text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return fontSize * 0.25; // Fallback to approximate space width

  ctx.font = `${fontSize}px ${fontFamily}`;
  const spaceMetrics = ctx.measureText(' ');

  return spaceMetrics.width;
}

/**
 * Updates an existing multi-color text group with new properties
 */
export function updateMultiColorText(group: fabric.Group, element: TextElement): void {
  // CRITICAL: Save current position from Fabric object BEFORE any modifications
  // The canvas is the source of truth for position during normal operations
  const currentLeft = group.left;
  const currentTop = group.top;

  // Remove all existing objects from the group
  const items = group.getObjects();
  items.forEach(item => group.remove(item));

  // Recreate text objects with new properties
  const words = element.text.trim().split(/\s+/);
  const colors = element.colors || (element.color ? [element.color] : ['#000000']);

  let currentX = 0;
  const spaceWidth = getSpaceWidth(element.fontFamily, element.fontSize);

  // CRITICAL: Convert 'bold' to 700 to prevent double-bold with custom fonts
  const fontWeight = element.fontWeight === 'bold' ? 700 : (element.fontWeight === 'normal' ? 400 : element.fontWeight || 400);

  words.forEach((word, index) => {
    const colorIndex = Math.min(index, colors.length - 1);
    const color = colors[colorIndex];

    const textObj = new fabric.Text(word, {
      left: currentX,
      top: 0,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      fill: color,
      fontWeight: fontWeight,
      fontStyle: element.fontStyle || 'normal',
      underline: element.underline || false,
      stroke: element.stroke || '',
      strokeWidth: element.strokeWidth || 0,
      textAlign: element.textAlign || 'left',
      selectable: false,
      evented: false,
    });

    group.add(textObj);
    currentX += textObj.width! + spaceWidth;
  });

  // Update group properties INCLUDING position (restore saved position)
  // Position must be restored because removing/adding children can reset it
  group.set({
    left: currentLeft,
    top: currentTop,
    angle: element.rotation || 0,
    opacity: element.opacity || 1,
    scaleX: 1, // CRITICAL: Ensure scale is always 1 after updating text
    scaleY: 1, // CRITICAL: Ensure scale is always 1 after updating text
    excludeFromExport: element.excludeFromExport || false,
  });

  // Update stored metadata
  (group as any).originalElement = element;

  // CRITICAL FIX: Trigger internal layout recalculation
  // This ensures the bounding box matches the actual content after changes
  group.setCoords();

  // Force Fabric to recalculate the group's bounding box and control positions
  // This fixes the detached handles issue when scaling
  if (group.canvas) {
    group.canvas.renderAll();
  }
}

/**
 * Checks if the element should use multi-color rendering
 */
export function shouldUseMultiColor(element: TextElement): boolean {
  return !!(element.colors && element.colors.length > 0);
}