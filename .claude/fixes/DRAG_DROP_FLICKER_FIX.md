# Drag and Drop Flicker Fix

## Issue
The "Import Batch" drop zone was experiencing flickering when dragging files over it. The box would rapidly toggle between the dragging and non-dragging states, making it very difficult to drop files.

## Root Cause
The flickering was caused by two main issues:

1. **Child Element Event Bubbling**: When dragging over child elements (SVG icon, text elements) inside the drop zone, the `dragleave` event would fire on the container and `dragenter` would fire on the child element. This caused the `isDragging` state to toggle rapidly.

2. **Pointer Events on Child Elements**: Child elements with default `pointer-events` behavior would receive drag events, interrupting the smooth drag detection over the parent container.

## Solution
Implemented two complementary fixes:

### 1. Drag Counter Pattern
Instead of directly toggling the `isDragging` state on `dragenter`/`dragleave`, we now use a counter:
- Increment counter on `dragenter`
- Decrement counter on `dragleave`
- Only set `isDragging` to `true` when counter goes from 0 to 1
- Only set `isDragging` to `false` when counter reaches 0
- Reset counter to 0 on `drop`

This ensures the dragging state remains stable even when moving over child elements.

### 2. Pointer Events: None on Children
Added `style={{ pointerEvents: 'none' }}` to all child elements inside the drop zone:
- SVG icon
- Text container (div)
- Loading spinner

This prevents child elements from receiving any pointer/drag events, ensuring all events are handled by the parent container.

## Files Modified
- `front-cards/features/batch-upload/components/UploadBatchComponent.tsx`
- `front-cards/features/batch-upload/components/FileUploadComponent.tsx`

## Testing
To test the fix:
1. Navigate to the dashboard with the "Import Batch" button
2. Drag a file from your file explorer over the button
3. Move the cursor around the button area, over the icon and text
4. Verify that the button maintains the highlighted state without flickering
5. Drop the file anywhere in the button area to confirm it uploads successfully

## Technical Details

### Before (Problematic)
```typescript
const handleDragEnter = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!isDisabled) {
    setIsDragging(true);  // Toggles immediately
  }
}, [isDisabled]);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);  // Toggles immediately
}, []);
```

### After (Fixed)
```typescript
const dragCounterRef = useRef(0);

const handleDragEnter = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (isDisabled) return;

  dragCounterRef.current++;
  if (dragCounterRef.current === 1) {
    setIsDragging(true);  // Only on first enter
  }
}, [isDisabled]);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  dragCounterRef.current--;
  if (dragCounterRef.current === 0) {
    setIsDragging(false);  // Only when fully exited
  }
}, []);

const handleDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset the drag counter and state
    dragCounterRef.current = 0;
    setIsDragging(false);

    // ... rest of drop logic
  },
  [handleFile, isDisabled]
);
```

## References
- MDN Web Docs: [Drag Operations](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_operations)
- Common pattern for handling drag events with nested elements
- CSS `pointer-events` property for event control
