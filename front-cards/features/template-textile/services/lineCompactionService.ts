/**
 * Line Compaction Service - CORRECTED IMPLEMENTATION
 * Removes empty lines and physically moves remaining lines upward to fill gaps
 */

import type { Template, TemplateElement, TextElement, ImageElement, QRElement } from '../types';

/**
 * Position map structure: sectionGroup -> lineNumber -> elementType -> position
 */
export interface PositionMap {
  [sectionGroup: string]: {
    [lineNumber: number]: {
      [elementType: string]: {
        x: number;
        y: number;
        rotation?: number;
        width?: number;
        height?: number;
      };
    };
  };
}

/**
 * Create original position map ONCE before batch processing
 * This stores the template's original element positions for each line
 */
export function createOriginalPositionMap(template: Template): PositionMap {
  const map: PositionMap = {};

  console.log('[LineCompaction] Creating original position map...');

  for (const element of template.elements) {
    // Skip elements not participating in line compaction
    if (!element.sectionGroup || !element.lineGroup) {
      continue;
    }

    const { sectionGroup, lineGroup } = element;

    // Parse lineGroup: "type-number" (e.g., "icon-1", "text-2")
    const match = lineGroup.match(/^(\w+)-(\d+)$/);
    if (!match) {
      console.warn(`[LineCompaction] Invalid lineGroup format: "${lineGroup}"`);
      continue;
    }

    const [, elementType, lineNumberStr] = match;
    const lineNumber = parseInt(lineNumberStr, 10);

    // Initialize nested structure
    if (!map[sectionGroup]) {
      map[sectionGroup] = {};
    }
    if (!map[sectionGroup][lineNumber]) {
      map[sectionGroup][lineNumber] = {};
    }

    // Store original position
    map[sectionGroup][lineNumber][elementType] = {
      x: element.x,
      y: element.y,
      rotation: element.rotation,
      width: element.width,
      height: element.height,
    };

    console.log(`[LineCompaction] Stored ${sectionGroup}/${lineGroup}: (${element.x}, ${element.y})`);
  }

  const sectionCount = Object.keys(map).length;
  console.log(`[LineCompaction] Position map created: ${sectionCount} section(s)`);

  return map;
}

/**
 * Determine which lines have content (non-empty primary element)
 * EMPTY LINE = line where text object with linePriority=1 has empty value
 */
function determineExistingLines(template: Template, sectionGroup: string): number[] {
  const lineElements = new Map<number, TemplateElement[]>();

  // Group elements by line number
  for (const element of template.elements) {
    if (element.sectionGroup !== sectionGroup || !element.lineGroup) {
      continue;
    }

    const match = element.lineGroup.match(/^(\w+)-(\d+)$/);
    if (!match) continue;

    const lineNumber = parseInt(match[2], 10);

    if (!lineElements.has(lineNumber)) {
      lineElements.set(lineNumber, []);
    }
    lineElements.get(lineNumber)!.push(element);
  }

  const existingLines: number[] = [];

  // Check each line's primary element (linePriority === 1)
  for (const [lineNumber, elements] of lineElements) {
    const primaryElement = elements.find(el => el.linePriority === 1);

    if (!primaryElement) {
      console.warn(`[LineCompaction] No primary element (linePriority=1) for line ${lineNumber} in "${sectionGroup}"`);
      continue;
    }

    // Check if primary element has content
    let hasContent = false;

    if (primaryElement.type === 'text') {
      const text = (primaryElement as TextElement).text?.trim();
      hasContent = Boolean(text && text.length > 0);
    } else if (primaryElement.type === 'image') {
      hasContent = Boolean((primaryElement as ImageElement).imageUrl);
    } else if (primaryElement.type === 'qr') {
      hasContent = Boolean((primaryElement as QRElement).data);
    } else {
      // For other types, consider them as having content if they exist
      hasContent = true;
    }

    if (hasContent) {
      existingLines.push(lineNumber);
      console.log(`[LineCompaction] Line ${lineNumber} in "${sectionGroup}" EXISTS (has content)`);
    } else {
      console.log(`[LineCompaction] Line ${lineNumber} in "${sectionGroup}" EMPTY (will be removed)`);
    }
  }

  // Sort in ascending order to preserve relative ordering
  return existingLines.sort((a, b) => a - b);
}

/**
 * Apply line compaction to a template
 *
 * Process:
 * 1. For each section group:
 *    a. Determine which lines exist (have content)
 *    b. REMOVE elements from empty lines
 *    c. MOVE elements from existing lines to fill gaps (using original position map)
 */
export function applyLineCompaction(
  template: Template,
  originalPositionMap: PositionMap
): Template {
  // Clone template to avoid mutation
  const compacted = JSON.parse(JSON.stringify(template)) as Template;

  console.log('[LineCompaction] Starting compaction...');

  // Get all unique section groups
  const sectionGroups = new Set<string>();
  for (const element of compacted.elements) {
    if (element.sectionGroup) {
      sectionGroups.add(element.sectionGroup);
    }
  }

  console.log(`[LineCompaction] Processing ${sectionGroups.size} section(s):`, Array.from(sectionGroups));

  // Process each section group independently
  for (const sectionGroup of sectionGroups) {
    console.log(`[LineCompaction] === Processing section: "${sectionGroup}" ===`);

    // Determine which lines exist
    const existingLines = determineExistingLines(compacted, sectionGroup);

    if (existingLines.length === 0) {
      // No lines have content - remove entire section
      console.log(`[LineCompaction] Removing entire section "${sectionGroup}" (no content)`);
      compacted.elements = compacted.elements.filter(el => el.sectionGroup !== sectionGroup);
      continue;
    }

    console.log(`[LineCompaction] Existing lines in "${sectionGroup}":`, existingLines);

    // Find all line numbers in this section
    const allLineNumbers = new Set<number>();
    for (const element of compacted.elements) {
      if (element.sectionGroup === sectionGroup && element.lineGroup) {
        const match = element.lineGroup.match(/^(\w+)-(\d+)$/);
        if (match) {
          allLineNumbers.add(parseInt(match[2], 10));
        }
      }
    }

    // Determine which lines to remove
    const linesToRemove = Array.from(allLineNumbers).filter(n => !existingLines.includes(n));

    console.log(`[LineCompaction] Lines to remove:`, linesToRemove);

    // STEP 1: REMOVE elements from empty lines
    if (linesToRemove.length > 0) {
      const beforeCount = compacted.elements.length;

      for (const lineNum of linesToRemove) {
        compacted.elements = compacted.elements.filter(element => {
          if (element.sectionGroup !== sectionGroup) return true;

          const match = element.lineGroup?.match(/^(\w+)-(\d+)$/);
          if (!match) return true;

          const elLineNum = parseInt(match[2], 10);
          const shouldRemove = elLineNum === lineNum;

          if (shouldRemove) {
            console.log(`[LineCompaction] REMOVED element ${element.id} (lineGroup: ${element.lineGroup})`);
          }

          return !shouldRemove;
        });
      }

      const afterCount = compacted.elements.length;
      console.log(`[LineCompaction] Removed ${beforeCount - afterCount} element(s) from empty lines`);
    }

    // STEP 2: MOVE remaining elements to fill gaps
    let targetPosition = 1;

    for (const sourceLineNumber of existingLines) {
      console.log(`[LineCompaction] Moving line ${sourceLineNumber} -> position ${targetPosition}`);

      // Get all elements from this source line
      const elementsToMove = compacted.elements.filter(element => {
        if (element.sectionGroup !== sectionGroup) return false;

        const match = element.lineGroup?.match(/^(\w+)-(\d+)$/);
        if (!match) return false;

        return parseInt(match[2], 10) === sourceLineNumber;
      });

      console.log(`[LineCompaction]   Found ${elementsToMove.length} element(s) to move`);

      // Move each element to target position
      for (const element of elementsToMove) {
        const match = element.lineGroup!.match(/^(\w+)-(\d+)$/);
        if (!match) continue;

        const elementType = match[1]; // 'icon', 'text', etc.
        const oldLineNum = parseInt(match[2], 10);

        // Get target position from original position map
        const targetPos = originalPositionMap[sectionGroup]?.[targetPosition]?.[elementType];

        if (targetPos) {
          const oldX = element.x;
          const oldY = element.y;

          // PHYSICALLY MOVE the element
          element.x = targetPos.x;
          element.y = targetPos.y;

          if (targetPos.rotation !== undefined) {
            element.rotation = targetPos.rotation;
          }

          // Update lineGroup to reflect new position
          const newLineGroup = `${elementType}-${targetPosition}`;
          element.lineGroup = newLineGroup;

          console.log(`[LineCompaction]   ${element.id}: (${oldX}, ${oldY}) -> (${element.x}, ${element.y}), lineGroup: ${match[0]} -> ${newLineGroup}`);
        } else {
          console.warn(`[LineCompaction]   No target position for ${elementType}-${targetPosition} in "${sectionGroup}"`);
        }
      }

      targetPosition++;
    }
  }

  console.log('[LineCompaction] Compaction complete');

  return compacted;
}
