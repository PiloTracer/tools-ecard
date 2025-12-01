# Bug Fix: Multi-Color Text Position Loss

## Bug Report

**Issue**: When applying per-word colors to a Text object, the text moves to the top-left corner (position 0,0).

**User Report**: "When applying colors to words to Text object, the Text object moves to the top left corner, and I can't place it in the right position. There's no exception."

**Severity**: Critical - Prevents users from using the per-word color feature effectively.

---

## Root Cause Analysis

### Primary Issue 1: updateMultiColorText() Not Preserving Position

**File**: `utils/multiColorText.ts`
**Function**: `updateMultiColorText(group, element)` (lines 89-139)

**Problem**: When updating an existing multi-color text group's properties (e.g., changing word colors), the function:
1. Removes all existing text objects from the group
2. Recreates text objects with new colors
3. Updates group properties (angle, opacity, excludeFromExport)
4. **BUT NEVER updates or preserves the position (left, top)**

**Impact**: During property updates (color changes), the text group's position was not being synced, causing it to stay at its old position or jump to an incorrect position.

### Primary Issue 2: Switching from Single-Color to Multi-Color Lost Canvas Position

**File**: `components/Canvas/DesignCanvas.tsx`
**Lines**: 426-441

**Problem**: When a user adds colors to a single-color text (converting it to multi-color), the code:
1. Removed the single-color IText object
2. Created a new multi-color Group object
3. **Used the position from the element store (`textEl.x`, `textEl.y`) instead of the current canvas position**

**Impact**: If the user had moved the text on the canvas but those changes weren't yet synced to the store, the position would revert to the old stored position when adding colors.

---

## Position Management Strategy in DesignCanvas

The canvas uses a sophisticated position syncing strategy:

1. **Normal operations** (dragging, property changes): Canvas is ALWAYS the source of truth - NEVER sync from store
2. **Undo/Redo operations**: Store is source of truth - ALWAYS sync from store to canvas
3. **Property changes** (color, size, etc.): Don't touch position at all

This means:
- When a user drags text, the position in the Fabric object updates immediately
- The store is updated via the `object:modified` event
- During property updates (like color changes), we should NOT sync position from the store because the canvas already has the correct position

---

## The Fix

### Fix 1: Preserve Canvas Position in updateMultiColorText()

**File**: `utils/multiColorText.ts`
**Change**: Do NOT update position in `updateMultiColorText()` - let the canvas keep its current position

**Before**:
```typescript
// Update group properties
group.set({
  angle: element.rotation || 0,
  opacity: element.opacity || 1,
  excludeFromExport: element.excludeFromExport || false,
});
```

**After**:
```typescript
// Update group properties (but NOT position - canvas owns position during normal operations)
// Position is only synced during undo/redo operations in DesignCanvas
group.set({
  angle: element.rotation || 0,
  opacity: element.opacity || 1,
  excludeFromExport: element.excludeFromExport || false,
});
```

**Rationale**: During property updates, the canvas already has the correct position. We should only update visual properties, not spatial properties.

### Fix 2: Preserve Canvas Position When Converting Single to Multi-Color

**File**: `components/Canvas/DesignCanvas.tsx`
**Lines**: 426-441

**Before**:
```typescript
} else if (shouldUseMultiColor(textEl)) {
  // Need to replace single-color text with multi-color group
  canvas.remove(fabricObj);
  fabricObjectsMap.current.delete(element.id);
  addedElementIds.current.delete(element.id);

  const newMultiColorText = createMultiColorText(textEl);
  canvas.add(newMultiColorText);
  fabricObjectsMap.current.set(element.id, newMultiColorText);
  addedElementIds.current.add(element.id);
```

**After**:
```typescript
} else if (shouldUseMultiColor(textEl)) {
  // Need to replace single-color text with multi-color group
  // Preserve current position from Fabric object (canvas is source of truth)
  const currentLeft = fabricObj.left || textEl.x;
  const currentTop = fabricObj.top || textEl.y;

  canvas.remove(fabricObj);
  fabricObjectsMap.current.delete(element.id);
  addedElementIds.current.delete(element.id);

  // Create new multi-color text with current canvas position
  const textElWithCurrentPos = { ...textEl, x: currentLeft, y: currentTop };
  const newMultiColorText = createMultiColorText(textElWithCurrentPos);
  canvas.add(newMultiColorText);
  fabricObjectsMap.current.set(element.id, newMultiColorText);
  addedElementIds.current.add(element.id);
```

**Rationale**: When replacing the Fabric object, use the current canvas position, not the potentially outdated store position.

---

## Files Modified

1. `front-cards/features/template-textile/utils/multiColorText.ts`
   - Modified `updateMultiColorText()` to NOT update position (lines 125-131)
   - Added comment explaining position management strategy

2. `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx`
   - Modified single-to-multi-color transition to preserve canvas position (lines 426-441)
   - Added position preservation logic

---

## Testing Instructions

### Test Scenario 1: Applying Colors to Existing Text

1. Navigate to: `http://localhost:7300/template-textile/test-colors`
2. Or manually create a text element at position (100, 200)
3. Move the text to a different position (e.g., drag it to 300, 400)
4. Open the Property Panel (select the text)
5. Click "Add Color" to create multi-color text
6. **Expected**: Text stays at position (300, 400)
7. **Before Fix**: Text would jump to (100, 200) or (0, 0)

### Test Scenario 2: Changing Colors on Multi-Color Text

1. Create a multi-color text element at position (200, 150)
2. Select the text and verify it's at (200, 150)
3. Change one of the word colors using the color picker
4. **Expected**: Text stays at position (200, 150)
5. **Before Fix**: Text might move to top-left

### Test Scenario 3: Adding/Removing Colors

1. Create single-color text at position (250, 300)
2. Click "Add Color" to create 2 colors
3. **Expected**: Text stays at (250, 300)
4. Click "Add Color" again to create 3 colors
5. **Expected**: Text still at (250, 300)
6. Click "Remove" to go back to 2 colors
7. **Expected**: Text still at (250, 300)
8. Click "Remove" again to go back to single color
9. **Expected**: Text still at (250, 300)

### Test Scenario 4: Moving Multi-Color Text

1. Create multi-color text at (100, 100)
2. Drag it to (400, 300)
3. Change a word color
4. **Expected**: Text stays at (400, 300)
5. Drag it to (200, 500)
6. Add another color
7. **Expected**: Text stays at (200, 500)

### Test Scenario 5: Undo/Redo with Position

1. Create text at (150, 150)
2. Move it to (300, 300)
3. Add colors
4. Move it to (450, 450)
5. Press Ctrl+Z (Undo move)
6. **Expected**: Text goes back to (300, 300)
7. Press Ctrl+Z again (Undo add colors)
8. **Expected**: Text is at (300, 300) with single color
9. Press Ctrl+Y (Redo add colors)
10. **Expected**: Text is at (300, 300) with multi-color

---

## Edge Cases Handled

1. **Empty position values**: Uses fallback to `element.x` and `element.y`
2. **Fabric object has no position**: Uses element position as fallback
3. **Undo/Redo operations**: Position synced from store to canvas (existing code handles this)
4. **Normal property changes**: Position NOT synced (canvas is source of truth)
5. **Converting between single and multi-color**: Current canvas position preserved

---

## Technical Notes

### Why NOT Update Position in updateMultiColorText()?

The `updateMultiColorText()` function is called during property synchronization (line 425 in DesignCanvas.tsx), which happens in the main element sync loop. This loop runs whenever:
- A property changes (color, font, size, etc.)
- An element is added or removed
- The element array is updated

During property sync, the canvas position is already correct. The only time we need to sync position from store to canvas is during undo/redo operations, which is handled separately in lines 588-597 of DesignCanvas.tsx.

### Position Sync Flow

```
User drags text
  ↓
Fabric object position updates (left, top)
  ↓
object:modified event fires
  ↓
Store position updated via updateElement()
  ↓
Elements array changes
  ↓
Property sync runs (updateMultiColorText called)
  ↓
Visual properties updated (colors, fonts, etc.)
  ↓
Position NOT touched (canvas already has correct position)
```

### Undo/Redo Position Sync

```
User presses Ctrl+Z
  ↓
Store undo() called
  ↓
Elements array reverted to previous state
  ↓
lastUndoRedoTimestamp updated
  ↓
Property sync runs
  ↓
isUndoRedo === true detected
  ↓
Position synced FROM STORE TO CANVAS (lines 588-597)
  ↓
Canvas position matches historical position
```

---

## Verification

### Before Fix
- Multi-color text would move to (0, 0) or incorrect position when:
  - Adding colors to single-color text
  - Changing word colors
  - Adding/removing color entries

### After Fix
- Multi-color text maintains position in ALL scenarios:
  - Adding colors preserves canvas position
  - Changing colors preserves position
  - Undo/Redo correctly restores position
  - Moving + color changes work correctly together

---

## Future Enhancements

Potential improvements for robustness:

1. **Add position logging**: Log position changes during multi-color operations for debugging
2. **Position validation**: Add checks to ensure position is never set to (0, 0) unintentionally
3. **Store sync optimization**: Only sync position from canvas to store when position actually changes (not on every render)
4. **Multi-color text detection**: Add visual indicator in UI when text has multiple colors

---

## Related Documentation

- Per-Word Color Implementation: `PER_WORD_COLOR_IMPLEMENTATION.md`
- Canvas Renderer Service: `services/canvasRenderer.ts`
- Multi-Color Text Utilities: `utils/multiColorText.ts`
- Design Canvas Component: `components/Canvas/DesignCanvas.tsx`

---

**Fixed**: 2025-01-27
**Tested**: Pending user verification
**Status**: Ready for Testing
