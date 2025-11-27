# Alt+Click Cycling - Quick Testing Guide

## Quick Start

1. Open the template designer
2. Add 2-3 text objects that overlap each other
3. Hold Alt key and click on the overlapping area
4. Keep clicking (while holding Alt) to cycle through the objects

## Visual Indicators

- **Purple Badge**: Shows "Object X of Y" when cycling
- **Auto-Hide**: Badge disappears after 1.5 seconds
- **Selection Handles**: Selected object shows blue selection box

## Test Checklist

### Basic Functionality

- [ ] **Test 1**: Three overlapping text objects
  - Add 3 text objects, make them overlap
  - Alt+Click cycles through all 3 objects
  - After clicking 3 times, cycles back to first object
  - Visual indicator shows "Object 1 of 3", "Object 2 of 3", "Object 3 of 3"

- [ ] **Test 2**: Different element types
  - Add overlapping: Text, Image, QR Code, Shape
  - Alt+Click cycles through all different types correctly
  - Each type can be selected and shows properties

- [ ] **Test 3**: Single object (no cycling)
  - Add one object
  - Alt+Click selects it
  - No "Object X of Y" indicator appears

- [ ] **Test 4**: Empty space
  - Alt+Click on empty canvas area
  - Selection is cleared
  - No indicator appears

### Location Detection

- [ ] **Test 5**: Same location clicks
  - Alt+Click to start cycling
  - Move mouse slightly (< 5 pixels) between clicks
  - Cycling continues (detects as same location)

- [ ] **Test 6**: Different location reset
  - Start cycling at one location (advance to object 2 or 3)
  - Alt+Click at a completely different location
  - Cycle resets to object 1 at new location

### Integration

- [ ] **Test 7**: Normal click (no Alt)
  - Click WITHOUT Alt on overlapping objects
  - Only top object is selected (normal Fabric.js behavior)
  - No cycling indicator appears

- [ ] **Test 8**: Property panel updates
  - Alt+Click to cycle through objects
  - Property panel updates to show selected object's properties
  - Properties match the selected object

- [ ] **Test 9**: Keyboard shortcuts still work
  - Select object via Alt+Click
  - Press Delete - object is deleted
  - Press Ctrl+D - object is duplicated
  - Press Escape - selection is cleared

### Edge Cases

- [ ] **Test 10**: Locked objects
  - Add overlapping objects, lock one
  - Alt+Click cycles through including locked object
  - Locked object shows selection but cannot be moved/resized

- [ ] **Test 11**: Grid interaction
  - Enable grid (if available)
  - Alt+Click does not select grid lines
  - Only selects actual template elements

- [ ] **Test 12**: Zoom levels
  - Set zoom to 50%
  - Alt+Click cycling works correctly
  - Set zoom to 200%
  - Alt+Click cycling works correctly

## Expected Behaviors

### Normal Alt+Click Cycle

```
Click 1: Selects Object 1 (top)    - Shows "Object 1 of 3"
Click 2: Selects Object 2 (middle) - Shows "Object 2 of 3"
Click 3: Selects Object 3 (bottom) - Shows "Object 3 of 3"
Click 4: Selects Object 1 (top)    - Shows "Object 1 of 3" (wraps around)
```

### Location Change

```
At Location A:
  Click 1: Object 1 of 3
  Click 2: Object 2 of 3

Move to Location B:
  Click 1: Object 1 of 2 (resets cycle at new location)
```

## Common Issues and Solutions

### Issue: Cycling doesn't work

**Check:**
- Are you holding Alt key?
- Are the objects actually overlapping?
- Are the objects selectable (not locked to prevent selection)?

### Issue: Indicator doesn't appear

**Expected:**
- Single object: No indicator (by design)
- Empty space: No indicator (by design)
- Multiple objects: Should show indicator

### Issue: Cycling skips objects

**Check:**
- Are all objects at the exact same location?
- Some objects might be slightly offset (zoom in to check)

### Issue: Can't select object underneath

**Solution:**
- Continue clicking - it cycles through ALL objects
- After reaching the last object, it wraps back to the first

## Performance Testing

### Large Canvas

- [ ] Add 20+ overlapping objects
- [ ] Alt+Click cycles smoothly without lag
- [ ] Visual indicator appears without delay

### Rapid Clicking

- [ ] Alt+Click very rapidly (5+ clicks/second)
- [ ] Cycling keeps up with clicks
- [ ] No missed selections
- [ ] Indicator updates correctly

## Browser Compatibility

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

**Note**: Alt key behavior may vary slightly by OS:
- Windows: Alt key
- Mac: Option key (typically works as Alt)

## Console Verification

Open browser console (F12) and look for:

```
[ALT+CLICK] Cycling: 1/3 objects at this location
[ALT+CLICK] Cycling: 2/3 objects at this location
[ALT+CLICK] Cycling: 3/3 objects at this location
```

These logs confirm the cycling logic is working correctly.

## Success Criteria

✅ Feature is working correctly if:

1. Multiple overlapping objects can be cycled through
2. Visual indicator shows current position (X of Y)
3. Selection updates property panel
4. Cycling wraps around after last object
5. Different locations reset the cycle
6. Single objects and empty space are handled gracefully
7. No interference with normal (non-Alt) clicking
8. No interference with other keyboard shortcuts
9. Performance is smooth even with many objects
10. Works across different browsers

## Reporting Issues

If you find a bug, please report:

1. **Steps to reproduce**: Exact sequence of actions
2. **Expected behavior**: What should happen
3. **Actual behavior**: What actually happened
4. **Browser/OS**: Which browser and operating system
5. **Console errors**: Any errors in browser console
6. **Screenshots**: Visual evidence of the issue

## Quick Demo Script

For demonstrating the feature:

```
1. "Let me show you the Alt+Click cycling feature"
2. Add 3 text objects: "Top", "Middle", "Bottom"
3. Overlap them significantly
4. "Watch what happens when I hold Alt and click..."
5. Click once: "First click selects the top object - see 'Object 1 of 3'"
6. Click again: "Second click cycles to the middle - see 'Object 2 of 3'"
7. Click again: "Third click gets the bottom object - 'Object 3 of 3'"
8. Click again: "And it wraps back to the top"
9. Click different location: "Clicking elsewhere resets the cycle"
```

## Done!

If all tests pass, the Alt+Click cycling feature is working correctly and ready for production use.
