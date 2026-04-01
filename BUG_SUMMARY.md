# PlayDeck Image Paste Bug - Executive Summary

## Problem Statement

Users report that **pasted images disappear** from their presentations after uploading. The images appear to upload successfully (users see them temporarily), but when the page reloads or live presentation syncs, the images are gone.

## Root Cause Analysis

This is **NOT a network or upload issue**. The images successfully upload to Jazz. The problem is **state synchronization** between:

1. **CodeMirror** (editor display)
2. **React state** (markdown and lastSavedMarkdown)
3. **Jazz persistence** (Deck.slides)
4. **Autosave timing** (600ms debounce with multiple concurrent timers)

## The Core Bug: Multiple Pending Autosave Timers

### What Happens

```javascript
useEffect(() => {
  if (markdownRef.current === lastSavedRef.current) return
  const t = setTimeout(() => {
    const current = markdownRef.current
    // ... autosave logic
    replaceSlidesFromMarkdown(me, deckId, current)
  }, 600ms)  // ← 600ms delay
  return () => clearTimeout(t)
}, [markdown])  // ← Runs on EVERY markdown change!
```

### Why It's Broken

1. **User types → Timer #1 scheduled** (fires at T+600ms)
2. **User pastes image → Timer #1 STILL PENDING, but Timer #2 scheduled** (fires at T+700ms)
3. **Image upload completes → React state updated → Timer #3 scheduled** (fires at T+800ms)
4. **At T+600ms**: Timer #1 fires
   - Reads `markdownRef.current` (which may have been reset by Jazz sync!)
   - If Jazz sync happened, markdownRef now points to OLD state (no image)
   - Saves old state WITHOUT the image
   - Image disappears ❌

## Secondary Issues Making It Worse

### Issue #1: Jazz Sync Can Reset State
When Jazz notifies React that slides changed, the sync effect resets React state:

```javascript
useEffect(() => {
  if (!markdownMatchesSlides(markdown, slides)) return
  const next = initialMarkdown(slides)
  setMarkdown(next)  // ← RESETS REACT STATE
}, [slidesSyncKey])
```

If this fires while the image is still uploading, and slides don't include the image yet, the image gets wiped from React state.

### Issue #2: Multiple Timer Race
With multiple timers pending:
- Timer #1 might save state WITHOUT image
- Timer #2 might overwrite with old data
- Timer #3 might then save state WITH image (too late)

Result: Last save wins, and if the wrong timer fires last, image is lost.

### Issue #3: hasPendingImageUpload() Check Too Simplistic
The autosave check only looks for `![uploading-X]()` placeholders:

```javascript
if (hasPendingImageUpload(current)) return
```

But this:
- Only checks placeholder syntax
- Doesn't track in-flight uploads after they're resolved
- Doesn't account for image IDs that haven't fully persisted yet

## Timeline of the Bug

```
T=0ms:   User pastes image
         CodeMirror: "text\n![uploading-abc]()\n"
         React: markdown = "text\n![uploading-abc]()\n"
         
T=50ms:  Effect: markdownRef.current = "text\n![uploading-abc]()\n" ✓
         Effect: setTimeout(..., 600ms) scheduled → Timer #1 at T=650ms

T=100ms: User types more text
         React: markdown = "text\nmore\n![uploading-abc]()\n"
         
T=110ms: Effect: markdownRef.current updated ✓
         Effect: NEW setTimeout(..., 600ms) scheduled → Timer #2 at T=710ms
         ⚠️ Timer #1 STILL PENDING

T=200ms: Image upload completes
         CodeMirror: "text\nmore\n![](jazz:xyz)\n"
         React: markdown = "text\nmore\n![](jazz:xyz)\n"
         
T=210ms: Effect: markdownRef.current updated ✓
         Effect: NEW setTimeout(..., 600ms) scheduled → Timer #3 at T=810ms
         ⚠️ Timers #1 and #2 STILL PENDING

T=300ms: ⚠️ Jazz syncs old state (slides without image yet)
         slidesSyncKey triggers
         setMarkdown(oldStateWithoutImage)
         React: markdown = "text\nmore\n" ← IMAGE REMOVED!
         
T=310ms: Effect: markdownRef.current = "text\nmore\n" ← IMAGE GONE!
         Effect: NEW setTimeout(..., 600ms) scheduled → Timer #4 at T=910ms

T=650ms: ⚠️ TIMER #1 FIRES (oldest timer)
         Reads: markdownRef.current = "text\nmore\n" ← NO IMAGE!
         Calls: replaceSlidesFromMarkdown("text\nmore\n")
         Jazz: Deck.slides = ["text\nmore\n"] ← IMAGE SAVED WITHOUT IT ❌

T=710ms: Timer #2 fires (also reads old state, saves again)

T=810ms: Timer #3 fires (tries to save with image, but too late)

T=910ms: Timer #4 fires (final save is outdated)

RESULT: User sees image disappear because oldest timer (T=650ms) 
        won the race and saved state without the image.
```

## Why This Happens in Production

The probability increases when:

1. **Image upload is slow** (>50ms): Gives more time for Jazz sync to happen
2. **Slow network**: More time for other state changes
3. **Multiple edits**: Creates more pending timers
4. **During live presentation**: More concurrent state changes

## Files Involved

| File | Issue |
|------|-------|
| `deck-editor-workspace.tsx` | Autosave effect creates multiple concurrent timers that can race |
| `deck-editor-workspace.tsx` | Refs updated in separate effect, not synchronized with autosave |
| `deck-editor-workspace.tsx` | Jazz sync effect can reset state while uploads pending |
| `codemirror-image-paste.ts` | Extension calls onDocChange callback which may be stale |
| `codemirror-image-drop.ts` | Same as paste, independent handlers don't coordinate |
| `deck-markdown-editor.tsx` | Multiple update paths for CodeMirror changes |
| `slide-markdown-document.ts` | hasPendingImageUpload check insufficient |
| `live-session-mutations.ts` | LiveSession markdown frozen, doesn't update when presenter edits |

## The Fix (High Level)

The solution requires **consolidating state synchronization**:

1. **Single source of truth**: One timer that fires once 600ms after LAST edit
2. **Proper coordination**: Don't overwrite React state from Jazz during uploads
3. **Better detection**: Track in-flight uploads, not just placeholders
4. **Atomic operations**: Jazz save and React state update should be together

## Recommended Changes

### 1. Use Single Autosave Timer (Not Multiple)
```javascript
const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

useEffect(() => {
  // Clear any pending timer
  if (autosaveTimeoutRef.current) {
    clearTimeout(autosaveTimeoutRef.current)
  }
  
  // Set single new timer
  if (markdown !== lastSavedMarkdown && !hasPendingImageUpload(markdown)) {
    autosaveTimeoutRef.current = setTimeout(() => {
      replaceSlidesFromMarkdown(me, deckId, markdown)
    }, 600)
  }
  
  return () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
  }
}, [markdown, lastSavedMarkdown])
```

### 2. Track In-Flight Uploads
```javascript
const inFlightUploadsRef = useRef<Set<string>>(new Set())

// In image extension:
const token = `uploading-${crypto.randomUUID()}`
inFlightUploadsRef.current.add(token)

onUpload(blob).then((result) => {
  inFlightUploadsRef.current.delete(token)
  // ... rest of logic
})

// In autosave check:
if (inFlightUploadsRef.current.size > 0) return
```

### 3. Disable Jazz Sync During Uploads
```javascript
const hasPendingUploads = inFlightUploadsRef.current.size > 0

useEffect(() => {
  if (hasPendingUploads) return  // Don't sync while uploading
  
  if (!markdownMatchesSlides(markdown, slides)) {
    setMarkdown(initialMarkdown(slides))
  }
}, [slidesSyncKey, slides, markdown, hasPendingUploads])
```

### 4. Ensure State Consistency
After image uploads complete:
```javascript
onUpload(blob).then((result) => {
  if ("error" in result) {
    // Clean up placeholder from React state
    const next = deleteToken(view.state.doc.toString(), token)
    setMarkdown(next)  // Update React state
    return
  }
  
  // Replace in CodeMirror
  const next = replaceToken(view.state.doc.toString(), token, result.id, "image")
  view.dispatch({...})
  
  // Immediately update React state to match
  setMarkdown(next)
  
  // Reset autosave timer
  triggerAutosave()  // Custom function to handle resetting timer
})
```

## Testing

Add tests for:
1. Image paste with 600ms delay
2. Multiple images pasting simultaneously
3. Image upload completing during Jazz sync
4. Rapid edits before upload completes
5. Live presentation state handling

## Questions to Verify

1. Do you see the image in the editor temporarily?
2. Does it disappear on page reload?
3. Does it disappear immediately or after a delay?
4. Does it happen with one image or multiple?
5. What's the typical image upload time in your logs?

## Severity

**CRITICAL** - Users lose data they pasted, violates user expectations.

## Recommended Action

Implement the single-timer fix immediately, as it's low-risk and high-impact.
