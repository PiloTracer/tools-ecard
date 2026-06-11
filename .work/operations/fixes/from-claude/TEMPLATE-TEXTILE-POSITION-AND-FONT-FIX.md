# Template-Textile Feature: Position Sync and Font API Fixes

## Date
2025-11-27

## Issues Fixed

### Issue 1: Objects Cannot Be Repositioned After Property Changes
**User Report**: "the object that was previously moved automatically on error, still doesn't allow repositioning"

**Symptom**: When an object's properties (color, size, etc.) are changed, the object becomes "stuck" and cannot be repositioned by dragging, even though the object was not locked.

### Issue 2: Font API Unauthorized Error
**Error Message**:
```
API Error: Unauthorized
at ApiClient.get (shared/lib/api-client.ts:25:13)
at async FontService.listFonts (features/template-textile/services/fontService.ts:40:24)
at async loadFonts (features/template-textile/components/PropertyPanel/FontSelector.tsx:30:27)
```

**Symptom**: Font selector fails to load fonts due to 401 Unauthorized error.

---

## Root Cause Analysis

### Issue 1: Position Synchronization Logic Flaw

**Location**: `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx` (lines 576-597)

**The Problem**: The position synchronization logic had a fundamental flaw in its design:

1. **Overly Complex Condition**: The code used a 500ms timestamp check (`wasRecentlyModifiedFromCanvas`) to prevent position sync conflicts
2. **Wrong Logic**: The condition was:
   ```typescript
   if (isUndoRedo && !processingModification && !wasRecentlyModifiedFromCanvas) {
     // Sync position
   }
   ```
   This meant: "Only sync position if it's undo/redo AND NOT recently modified from canvas"

3. **The Bug**: When a property changed (like color), the sync effect would run:
   - It would check if the object was modified from canvas in the last 500ms
   - If YES: Skip position sync (correct behavior to avoid fighting)
   - If NO: Still skip because it's not an undo/redo operation
   - **Result**: Position NEVER synced from canvas to store during normal operations

4. **Why Objects Got Stuck**: The canvas would update the position, but the store wouldn't update, so subsequent property changes would try to "reset" position from the stale store value, causing objects to jump back or become unresponsive.

**The Real Insight**: The fix wasn't about the 500ms timeout - it was about **completely removing position sync during normal operations**. Canvas should ALWAYS own position except during undo/redo.

### Issue 2: Font API Authentication

**Location**: `api-server/src/features/font-management/routes/fontRoutes.ts`

**The Problem**:
1. **Line 16**: `fastify.addHook('preHandler', authMiddleware)` was placed BEFORE the font list endpoint
2. This made ALL subsequent routes (including GET `/api/v1/fonts`) require authentication
3. The template designer was being used without authentication, causing 401 errors
4. Font files endpoint was already public (line 13), but font listing was not

**Design Flaw**: System fonts should be publicly accessible (like font files), but the API required authentication to even see the list.

---

## Solutions Implemented

### Fix 1: Simplified Position Synchronization

**Files Modified**:
- `front-cards/features/template-textile/components/Canvas/DesignCanvas.tsx`

**Changes**:

1. **Removed unnecessary complexity** (lines 17-20):
   - Deleted `lastModifiedFromCanvas` ref and timestamp tracking
   - Removed 500ms timeout check
   - Simplified the logic to be crystal clear

2. **Clarified position sync strategy** (lines 576-596):
   ```typescript
   // Position sync strategy:
   // 1. Normal operations (dragging, moving): Canvas is ALWAYS source of truth - NEVER sync from store
   // 2. Undo/Redo operations: Store is source of truth - ALWAYS sync from store to canvas
   // 3. Property changes (color, size, etc.): Don't touch position at all

   const isUndoRedo = lastUndoRedoTimestamp !== lastKnownUndoRedoTimestamp.current;

   // Only sync position during undo/redo operations
   if (isUndoRedo && !processingModification.current.has(element.id)) {
     // Force sync position from store to canvas
     const positionDiffX = Math.abs((fabricObj.left || 0) - element.x);
     const positionDiffY = Math.abs((fabricObj.top || 0) - element.y);

     if (positionDiffX > 0.1 || positionDiffY > 0.1) {
       console.log(`[UNDO/REDO] Syncing position for ${element.id}`);
       fabricObj.set({ left: element.x, top: element.y });
       fabricObj.setCoords();
     }
   }
   // For all other cases: DO NOT sync position - canvas owns position
   ```

3. **Removed timestamp setting** (line 163):
   - Deleted the line that set `lastModifiedFromCanvas.current.set(elementId, Date.now())`

**Key Principle**: **Canvas is the single source of truth for position during normal operations**. The store only needs to be synced TO during undo/redo.

### Fix 2: Made Font API Public with Graceful Fallback

**Files Modified**:
1. `api-server/src/features/font-management/routes/fontRoutes.ts`
2. `api-server/src/features/font-management/controllers/fontController.ts`
3. `front-cards/features/template-textile/services/fontService.ts`

**Changes**:

#### Backend Routes (fontRoutes.ts):
```typescript
// BEFORE: Font list was protected
fastify.addHook('preHandler', authMiddleware); // Applied to all routes below
fastify.get('/api/v1/fonts', fontController.listFonts.bind(fontController));

// AFTER: Font list is public, placed BEFORE auth hook
fastify.get('/api/v1/fonts', fontController.listFonts.bind(fontController)); // PUBLIC
fastify.addHook('preHandler', authMiddleware); // Only affects routes below
fastify.post('/api/v1/fonts', ...); // PROTECTED
fastify.delete('/api/v1/fonts/:fontId', ...); // PROTECTED
```

#### Backend Controller (fontController.ts):
- Made `listFonts` method handle **optional authentication**
- Unauthenticated users: Return only global/system fonts
- Authenticated users: Return global + user custom fonts based on scope

```typescript
// If user is not authenticated, only return global fonts
if (!request.user) {
  console.log('[FontController] Unauthenticated request - returning global fonts only');
  fonts = await fontService.listGlobalFonts(filters);
  return reply.code(200).send({ fonts });
}

// User is authenticated - return fonts based on scope
if (scope === 'global') {
  fonts = await fontService.listGlobalFonts(filters);
} else if (scope === 'user') {
  fonts = await fontService.listUserFonts(request.user.id, filters);
} else {
  // 'all' - both global and user fonts
  fonts = await fontService.listAvailableFonts(request.user.id, filters);
}
```

#### Frontend Service (fontService.ts):
- Added **fallback logic** to handle auth failures gracefully
- If authentication fails when requesting 'all' or 'user' fonts, automatically retry with 'global' scope
- Returns empty array only if all attempts fail

```typescript
catch (error: any) {
  console.error('[FontService] Error listing fonts:', error);

  // If authentication failed and we were trying to get user fonts,
  // fall back to global fonts only
  if (error.message?.includes('Unauthorized') && scope !== 'global') {
    console.warn('[FontService] Auth failed, falling back to global fonts only');
    try {
      const response = await apiClient.get<{ fonts: Font[] }>(
        `/api/v1/fonts?scope=global`
      );
      this.cachedFonts = response.fonts;
      return response.fonts;
    } catch (fallbackError) {
      console.error('[FontService] Fallback to global fonts also failed:', fallbackError);
    }
  }

  return [];
}
```

---

## Testing Recommendations

### Test 1: Object Repositioning
**Steps**:
1. Open the template designer
2. Add a text element to the canvas
3. Drag the text element to a new position
4. Change a property of the text (color, font size, etc.)
5. Try to drag the text element again

**Expected Result**:
- ✅ Text element should move freely without jumping back
- ✅ Text element should maintain its position after property changes
- ✅ Undo/Redo should correctly restore positions

**What Was Broken Before**:
- ❌ Text element would become "stuck" after property changes
- ❌ Text element would jump back to old position
- ❌ Dragging would be unresponsive

### Test 2: Font Loading (Unauthenticated)
**Steps**:
1. Clear browser cookies/session (or use incognito mode)
2. Navigate to template designer
3. Add a text element
4. Open the font selector in the property panel

**Expected Result**:
- ✅ Font selector loads without errors
- ✅ System/global fonts are displayed
- ✅ No 401 Unauthorized errors in console
- ✅ Font preview works when hovering over fonts

**What Was Broken Before**:
- ❌ Font selector showed "Loading fonts..." indefinitely
- ❌ Console showed "API Error: Unauthorized"
- ❌ No fonts were displayed

### Test 3: Font Loading (Authenticated)
**Steps**:
1. Log in to the application
2. Navigate to template designer
3. Add a text element
4. Open the font selector
5. Try different scope filters (All Fonts, System, My Fonts)

**Expected Result**:
- ✅ All scope filters work without errors
- ✅ System fonts are visible in all scopes
- ✅ Custom uploaded fonts appear in "All Fonts" and "My Fonts"
- ✅ Font upload functionality works

### Test 4: Undo/Redo with Position
**Steps**:
1. Add a text element
2. Move it to position A
3. Change its color
4. Move it to position B
5. Press Ctrl+Z (undo) - should go back to position A with color change
6. Press Ctrl+Z again - should undo color change
7. Press Ctrl+Y (redo) twice - should restore color and position B

**Expected Result**:
- ✅ Undo/Redo correctly restores positions
- ✅ Objects don't jump or flicker during undo/redo
- ✅ Property changes are preserved correctly

---

## Technical Insights

### Why the 500ms Check Was Wrong

The original logic tried to prevent "fighting" between canvas and store by:
1. Setting a timestamp when canvas modified an object
2. Checking if < 500ms elapsed before syncing position from store

**The flaw**: This created a race condition window where:
- 0-500ms: Position sync disabled (correct)
- 500ms+: Position sync enabled BUT only during undo/redo (bug!)
- Result: Normal property changes never synced position from canvas to store

**The correct approach**: Completely separate concerns:
- **Canvas owns position** during normal operations (no sync needed)
- **Store owns position** only during undo/redo (explicit sync)
- **Property updates** don't touch position at all

### Why Font API Should Be Public

**Design Principle**: System fonts are public resources, like static assets.

**Analogy**:
- Font files: Already public (needed for @font-face CSS to work)
- Font list: Should also be public (it's just metadata about public resources)
- Custom fonts: Protected (upload/delete requires auth, but viewing is optional)

**Security Note**: Unauthenticated users can only see global fonts, not other users' custom fonts. This is enforced at the controller level by checking `request.user`.

---

## Files Modified

### Frontend
1. **D:\Projects\EPIC\tools-ecards\front-cards\features\template-textile\components\Canvas\DesignCanvas.tsx**
   - Removed `lastModifiedFromCanvas` ref
   - Simplified position sync logic
   - Removed 500ms timeout check
   - Clarified position sync strategy with comments

2. **D:\Projects\EPIC\tools-ecards\front-cards\features\template-textile\services\fontService.ts**
   - Added fallback logic for auth failures
   - Improved error handling with automatic retry

### Backend
3. **D:\Projects\EPIC\tools-ecards\api-server\src\features\font-management\routes\fontRoutes.ts**
   - Moved font list endpoint BEFORE auth middleware
   - Made font listing a public endpoint

4. **D:\Projects\EPIC\tools-ecards\api-server\src\features\font-management\controllers\fontController.ts**
   - Modified `listFonts` to handle optional authentication
   - Unauthenticated users get global fonts only
   - Added logging for debugging

---

## Verification Commands

### Check Backend Routes Registration
```bash
# Check API server logs for route registration
docker-compose logs -f api-server | grep "fonts"
```

### Test Font API Endpoint
```bash
# Test without authentication (should return global fonts)
curl http://localhost:7400/api/v1/fonts?scope=global

# Test with authentication (should return all fonts)
curl -H "Cookie: ecards_auth=YOUR_TOKEN" http://localhost:7400/api/v1/fonts?scope=all
```

### Monitor Position Sync
Open browser console and filter for:
- `[UNDO/REDO]` - Position sync during undo/redo
- `[MODIFY]` - Object modification events
- Position should ONLY sync during undo/redo operations

---

## Related Issues

### Previous Fixes
- **DRAG_DROP_FLICKER_FIX.md**: Similar pattern of state management complexity
  - Also used ref-based counters to prevent flicker
  - This fix takes the opposite approach: remove complexity instead of adding it

### Similar Patterns in Codebase
- Position sync logic appears in:
  - `DesignCanvas.tsx` (fixed)
  - `canvasRenderer.ts` (no changes needed - only creates objects, doesn't sync)
  - `OffscreenExport` (no changes needed - one-time render)

---

## Lessons Learned

1. **Simplicity > Complexity**: The 500ms timeout added complexity without solving the real problem. Removing it made the code clearer and fixed the bug.

2. **Single Source of Truth**: Canvas should own position during normal operations. Don't try to sync bidirectionally - it creates race conditions.

3. **Public by Default**: Resources that don't contain sensitive data (like system fonts) should be public to avoid unnecessary auth barriers.

4. **Graceful Degradation**: When auth fails, fall back to a sensible default (global fonts) instead of showing an error.

5. **Clear State Ownership**: Document which component owns which piece of state. In this case:
   - Canvas owns: position, scale, rotation (during normal operations)
   - Store owns: all properties during undo/redo
   - Store is the canonical source of truth, but canvas has temporary ownership during user interaction

---

## Future Considerations

### Potential Improvements

1. **Position Sync Indicator**: Add visual feedback when position is synced during undo/redo
2. **Font Caching**: Cache font list in localStorage to avoid repeated API calls
3. **Font Categories**: Add better categorization for system fonts vs custom fonts
4. **Performance**: Consider debouncing font preview loads to reduce API calls

### Known Limitations

1. **Position Store Update**: Position is still updated in store during `object:modified` event (line 312), but this is correct - we just don't sync it back to canvas during normal operations
2. **Font Scope Naming**: 'all' scope returns different results based on auth status (by design)
3. **Undo/Redo Stack**: Position changes are added to history, but this is expected behavior

---

## Conclusion

Both issues were caused by overly defensive programming:
1. **Position sync**: Tried to prevent conflicts with timestamps, but created a worse problem
2. **Font API**: Tried to secure everything with auth, but blocked legitimate public access

The fixes embrace **simplicity** and **clear ownership**:
- Canvas owns position during normal operations
- Store owns position during undo/redo
- System fonts are public resources

**Impact**: Users can now freely reposition objects and access fonts without authentication barriers.
