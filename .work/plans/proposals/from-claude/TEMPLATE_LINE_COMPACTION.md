# Template Line Compaction Strategy - CORRECTED

## Overview
Line compaction removes empty lines and physically moves remaining lines upward to eliminate gaps. The process happens **within each sectionGroup** during batch export.

## Critical Understanding

### What Actually Happens

1. **Identify empty lines**: Lines where the primary element (`linePriority === 1`) has no content
2. **Remove empty line elements**: Delete ALL elements (icons, text, etc.) from empty lines
3. **Move remaining elements UP**: Physically relocate elements from existing lines to fill gaps
4. **Use original position map**: Target positions come from the secondary position map, NOT current positions

### Key Point: PHYSICAL MOVEMENT
Elements don't just "reassign" their `lineGroup` - they **physically move** to new X,Y coordinates from the position map.

## Real-World Examples

### Example 1: Viviana (Line 1 empty)

**Original Template Setup**:
```
Line 1: icon-1 (10, 50), text-1 (50, 50) [work_phone field, linePriority=1]
Line 2: icon-2 (10, 80), text-2 (50, 80) [mobile_phone field, linePriority=1]
Line 3: icon-3 (10, 110), text-3 (50, 110) [email field, linePriority=1]
```

**Record Data**:
- work_phone: "" (empty)
- mobile_phone: "+1234567890"
- email: "www.codedg.com"

**Step-by-Step Compaction**:

1. **Check primary elements**:
   - text-1 (work_phone): empty → Line 1 REMOVED ❌
   - text-2 (mobile_phone): has data → Line 2 EXISTS ✅
   - text-3 (email): has data → Line 3 EXISTS ✅

2. **Existing lines**: [2, 3]

3. **Remove Line 1 elements**:
   ```
   elements = elements.filter(el => el.lineGroup !== 'icon-1' && el.lineGroup !== 'text-1')
   ```

4. **Move Line 2 → Position 1** (target position index = 1):
   ```typescript
   // Get Line 2 elements
   icon-2 element: move to originalPositionMap['contact-info'][1]['icon'] = (10, 50)
   text-2 element: move to originalPositionMap['contact-info'][1]['text'] = (50, 50)

   // Update their lineGroup
   icon-2.lineGroup = 'icon-1'
   text-2.lineGroup = 'text-1'
   ```

5. **Move Line 3 → Position 2** (target position index = 2):
   ```typescript
   // Get Line 3 elements
   icon-3 element: move to originalPositionMap['contact-info'][2]['icon'] = (10, 80)
   text-3 element: move to originalPositionMap['contact-info'][2]['text'] = (50, 80)

   // Update their lineGroup
   icon-3.lineGroup = 'icon-2'
   text-3.lineGroup = 'text-2'
   ```

**Final Result**:
```
Line 1: mobile phone icon + "+1234567890" at (10,50) and (50,50)
Line 2: email icon + "www.codedg.com" at (10,80) and (50,80)
Line 3: GONE (no elements)
```

### Example 2: Kendall (Line 2 empty)

**Original Template Setup**: Same as above

**Record Data**:
- work_phone: "+(506) 2435-6096"
- mobile_phone: "" (empty)
- email: (not shown in image, assume empty or not rendered)

**Step-by-Step Compaction**:

1. **Check primary elements**:
   - text-1 (work_phone): has data → Line 1 EXISTS ✅
   - text-2 (mobile_phone): empty → Line 2 REMOVED ❌
   - text-3 (email): empty → Line 3 REMOVED ❌

2. **Existing lines**: [1]

3. **Line 1 stays** (already at position 1):
   ```
   icon-1 stays at (10, 50)
   text-1 stays at (50, 50)
   ```

4. **Remove Line 2 elements**:
   ```
   elements = elements.filter(el => el.lineGroup !== 'icon-2' && el.lineGroup !== 'text-2')
   ```

5. **Remove Line 3 elements**:
   ```
   elements = elements.filter(el => el.lineGroup !== 'icon-3' && el.lineGroup !== 'text-3')
   ```

**Final Result**:
```
Line 1: work phone icon + "+(506) 2435-6096" at (10,50) and (50,50)
Line 2: GONE
Line 3: GONE
```

### Example 3: Lines 1 and 2 empty

**Record Data**:
- work_phone: "" (empty)
- mobile_phone: "" (empty)
- email: "contact@example.com"

**Step-by-Step Compaction**:

1. **Existing lines**: [3]

2. **Remove Line 1 and Line 2 elements**

3. **Move Line 3 → Position 1**:
   ```typescript
   icon-3: move to (10, 50)  // original icon-1 position
   text-3: move to (50, 50)  // original text-1 position
   icon-3.lineGroup = 'icon-1'
   text-3.lineGroup = 'text-1'
   ```

**Final Result**:
```
Line 1: email icon + "contact@example.com" at (10,50) and (50,50)
```

## Correct Algorithm

### Step 1: Create Position Map (ONCE before batch loop)

```typescript
function createOriginalPositionMap(template: Template): PositionMap {
  const map: PositionMap = {};

  for (const element of template.elements) {
    if (!element.sectionGroup || !element.lineGroup) continue;

    const match = element.lineGroup.match(/^(\w+)-(\d+)$/);
    if (!match) continue;

    const [, elementType, lineNumberStr] = match;
    const lineNumber = parseInt(lineNumberStr, 10);

    if (!map[sectionGroup]) map[sectionGroup] = {};
    if (!map[sectionGroup][lineNumber]) map[sectionGroup][lineNumber] = {};

    // Store original position for this element type at this line number
    map[sectionGroup][lineNumber][elementType] = {
      x: element.x,
      y: element.y,
      rotation: element.rotation,
      // ... other positional properties
    };
  }

  return map;
}
```

### Step 2: Determine Existing Lines

```typescript
function getExistingLines(template: Template, sectionGroup: string): number[] {
  const lines = new Map<number, TemplateElement[]>();

  // Group elements by line number
  for (const el of template.elements) {
    if (el.sectionGroup !== sectionGroup) continue;
    const match = el.lineGroup?.match(/^(\w+)-(\d+)$/);
    if (!match) continue;

    const lineNum = parseInt(match[2], 10);
    if (!lines.has(lineNum)) lines.set(lineNum, []);
    lines.get(lineNum)!.push(el);
  }

  const existing: number[] = [];

  // Check each line's primary element
  for (const [lineNum, elements] of lines) {
    const primary = elements.find(el => el.linePriority === 1);
    if (!primary) continue;

    // Check if primary has content
    let hasContent = false;
    if (primary.type === 'text') {
      hasContent = Boolean((primary as TextElement).text?.trim());
    }
    // ... other types

    if (hasContent) existing.push(lineNum);
  }

  return existing.sort((a, b) => a - b);
}
```

### Step 3: Apply Compaction

```typescript
function applyLineCompaction(template: Template, posMap: PositionMap): Template {
  const result = JSON.parse(JSON.stringify(template)) as Template;

  // Get all section groups
  const sections = new Set(result.elements.map(el => el.sectionGroup).filter(Boolean));

  for (const section of sections) {
    const existingLines = getExistingLines(result, section);

    if (existingLines.length === 0) {
      // Remove all elements in this section
      result.elements = result.elements.filter(el => el.sectionGroup !== section);
      continue;
    }

    // Build list of elements to remove
    const allLineNumbers = new Set<number>();
    for (const el of result.elements) {
      if (el.sectionGroup === section && el.lineGroup) {
        const match = el.lineGroup.match(/^(\w+)-(\d+)$/);
        if (match) allLineNumbers.add(parseInt(match[2], 10));
      }
    }

    const linesToRemove = Array.from(allLineNumbers).filter(n => !existingLines.includes(n));

    // STEP 1: Remove elements from empty lines
    for (const lineNum of linesToRemove) {
      result.elements = result.elements.filter(el => {
        if (el.sectionGroup !== section) return true;
        const match = el.lineGroup?.match(/^(\w+)-(\d+)$/);
        if (!match) return true;
        return parseInt(match[2], 10) !== lineNum;
      });
    }

    // STEP 2: Move remaining elements to fill gaps
    let targetPosition = 1;

    for (const sourceLineNum of existingLines) {
      // Get all elements from this source line
      const elementsToMove = result.elements.filter(el => {
        if (el.sectionGroup !== section) return false;
        const match = el.lineGroup?.match(/^(\w+)-(\d+)$/);
        return match && parseInt(match[2], 10) === sourceLineNum;
      });

      // Move each element to target position
      for (const el of elementsToMove) {
        const match = el.lineGroup!.match(/^(\w+)-(\d+)$/);
        const elementType = match![1];

        // Get target position from map
        const targetPos = posMap[section]?.[targetPosition]?.[elementType];

        if (targetPos) {
          // PHYSICALLY MOVE the element
          el.x = targetPos.x;
          el.y = targetPos.y;
          if (targetPos.rotation !== undefined) el.rotation = targetPos.rotation;

          // Update lineGroup to reflect new position
          el.lineGroup = `${elementType}-${targetPosition}`;
        }
      }

      targetPosition++;
    }
  }

  return result;
}
```

## Integration

### batchExportService.ts Changes

```typescript
// Line 12: Add import
import { createOriginalPositionMap, applyLineCompaction } from './lineCompactionService';

// Line ~365: Create position map ONCE
const originalPositionMap = createOriginalPositionMap(template);

// Line ~390: Apply compaction per record
const populatedTemplate = applyRecordData(template, record);
const compactedTemplate = applyLineCompaction(populatedTemplate, originalPositionMap);
const result = await exportTemplate(compactedTemplate, options);
```

## Critical Points

1. ✅ **Position map created ONCE** - Before processing any records
2. ✅ **Physical movement** - Elements get new x,y coordinates, not just metadata changes
3. ✅ **Use original positions** - Target positions from map, not current element positions
4. ✅ **Remove then move** - First remove empty line elements, then move remaining ones
5. ✅ **Per-section compaction** - Each sectionGroup compacts independently
6. ✅ **Relative order preserved** - Line 2 always comes before Line 3 in final output
7. ✅ **Graceful degradation** - Works without metadata (no compaction applied)

## Common Mistakes to Avoid

❌ **DON'T** just filter elements and keep them at old positions
❌ **DON'T** use current element positions as targets
❌ **DON'T** forget to update lineGroup after moving
❌ **DON'T** remove elements after moving them
❌ **DON'T** move elements without checking if target position exists

✅ **DO** physically move elements to new coordinates
✅ **DO** use originalPositionMap for target positions
✅ **DO** update lineGroup to match new position
✅ **DO** remove empty line elements first
✅ **DO** handle missing target positions gracefully
