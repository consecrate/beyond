# PlayDeck Image Paste State Management Analysis

## Executive Summary

The PlayDeck app has **critical logic bugs** in how pasted/dropped images are managed across:
1. CodeMirror (editor state)
2. React state (`markdown` and `lastSavedMarkdown`)
3. Autosave/Jazz persistence
4. Live presentation snapshots (`LiveSession.markdown`)

These bugs cause **pasted images to disappear** due to stale state overwrites and lack of synchronization between multiple state sources. The issues are NOT syntax errors but fundamental architectural problems in state flow.

---

## State Architecture Overview

### Three Independent State Sources (❌ Not synchronized)

```
┌─────────────────────────────────────────────────────────────────┐
│ STATE SOURCE 1: CodeMirror Internal State                       │
│ - Actual editor content visible to user                         │
│ - Updates via view.dispatch() in handlers                       │
│ - Triggers onChange() callback to React                         │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STATE SOURCE 2: React State (deck-editor-workspace.tsx)         │
│ - markdown (current editing state)                              │
│ - lastSavedMarkdown (last persisted state)                      │
│ - markdownRef/lastSavedRef (refs to prevent stale closures)    │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ STATE SOURCE 3: Jazz Persistence Layer                          │
│ - Deck.slides in Jazz data model                                │
│ - Synced via replaceSlidesFromMarkdown()                        │
│ - On live: frozen in LiveSession.markdown                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Bug #1: Autosave Race Condition

**File:** `apps/playdeck/features/decks/components/deck-editor-workspace.tsx`
**Lines:** 93-113

### The Problem

```typescript
useEffect(() => {
  if (markdownRef.current === lastSavedRef.current) return
  const t = setTimeout(() => {
    const current = markdownRef.current
    if (current === lastSavedRef.current) return
    if (hasPendingImageUpload(current)) return  // ⚠️ Check exists but see Bug #2
    if (!me.$isLoaded) return
    assertLoaded(me.root)
    startSaveTransition(() => {
      const r = replaceSlidesFromMarkdown(me, deckId, current)
      // ... update lastSavedRef
    })
  }, AUTOSAVE_MS)  // 600ms delay
  return () => clearTimeout(t)
}, [markdown, deckId, me])  // ⚠️ Dependency on 'markdown'
```

### Why It's Broken

1. **Stale Closure Bug**: When a user:
   - Types some text → `markdown` state updates
   - Pastes an image → new `markdown` with `![uploading-X]()` 
   - Image upload completes AFTER the 600ms autosave timeout
   - The timeout closure had the OLD `markdown` WITHOUT the image

2. **Timeline of Disaster**:
   ```
   T=0ms: User types "hello"
   T=100ms: Paste image → markdown = "hello\n![uploading-abc]()\n"
   T=150ms: Upload complete → replaceToken() called
            - Updates CodeMirror view ✓
            - Calls onDocChange() → setMarkdown() ✓
            - But the setTimeout was already scheduled with OLD markdown!
   T=600ms: Autosave fires with markdownRef.current = "hello" 
            (the original, before image paste!)
            - Calls replaceSlidesFromMarkdown("hello")
            - Jazz syncs "hello" (no image)
            - User sees image disappear ❌
   T=700ms: New markdown with image arrives from upload completion
            - Too late, already saved the old state!
   ```

3. **The hasPendingImageUpload() Check is Insufficient**:
   ```typescript
   if (hasPendingImageUpload(current)) return
   ```
   This only checks the CURRENT state, but the race condition is:
   - Upload completes
   - Placeholder is REPLACED with `![](jazz:id)`
   - No more pending uploads detected
   - But autosave of the old state is still waiting to fire

### Root Cause

The `useEffect` dependency includes `markdown`, which means it re-runs on every markdown change. But the closure inside the `setTimeout` captures the OLD `markdownRef` value, and if the image upload completes AFTER the timeout is set but BEFORE it fires, the upload's changes are lost.

---

## Critical Bug #2: Placeholder Detection Race Condition

**File:** `apps/playdeck/features/decks/codemirror-image-paste.ts`
**Lines:** 71-90

### The Problem

```typescript
onUpload(blob).then((result) => {
  const current = view.state.doc.toString()  // ⚠️ Reads CodeMirror
  if ("error" in result) {
    const next = deleteToken(current, token)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: deleteToken(current, token) },
    })
    onDocChange?.(next)  // ⚠️ May call stale version of onChange
    return
  }
  const next = replaceToken(current, token, result.id, "image")
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: next,
    },
  })
  onDocChange?.(next)
})
```

### Why It's Broken

1. **onDocChange Closure Problem**: 
   - `onDocChange` is passed from `deck-markdown-editor.tsx`'s `syncParentFromView`
   - Which calls `onChange` from parent (in workspace)
   - The `onChange` is the `setMarkdown` function
   - By the time upload completes, there may be a NEW `onChange` from props re-render
   - But the original closure captures the OLD `onChange`

2. **Race with User Edits**:
   ```
   T=0ms: Paste image → token = "uploading-abc"
          CodeMirror: "hello\n![uploading-abc]()\nworld"
          React: markdown = "hello\n![uploading-abc]()\nworld"
   
   T=50ms: User types "!" after first line
          CodeMirror: "hello!\n![uploading-abc]()\nworld"
          React: markdown = "hello!\n![uploading-abc]()\nworld"
   
   T=2000ms: Upload completes
           - Reads `view.state.doc.toString()` → "hello!\n![uploading-abc]()\nworld"
           - Replaces token → "hello!\n![](jazz:xyz)\nworld"
           - Calls view.dispatch ✓
           - Calls onDocChange("hello!\n![](jazz:xyz)\nworld") → setMarkdown ✓
           
   BUT: Meanwhile...
   
   T=2100ms: Autosave timer (set at T=50ms) fires
           - Reads markdownRef.current (should be the image version)
           - But if another Markdown change triggered a new useEffect...
           - markdownRef might have been reset!
   ```

---

## Critical Bug #3: CodeMirror ↔ React State Mismatch

**File:** `apps/playdeck/features/decks/components/deck-markdown-editor.tsx`
**Lines:** 136-137, 44-49

### The Problem

```typescript
// deck-markdown-editor.tsx:
<CodeMirror
  value={value}  // React prop
  onChange={onChange}  // Calls setMarkdown in parent
/>

// But also:
const syncParentFromView = useCallback(
  (nextValue: string) => {
    onChange(nextValue)  // ⚠️ Manual sync on image paste/drop
  },
  [onChange],
)
```

### Why It's Broken

1. **Two Independent Update Paths**:
   - Normal editing: User types → CodeMirror onChange fires → calls React setMarkdown ✓
   - Image upload: Extension calls onDocChange directly → calls React setMarkdown separately
   - These updates may arrive in different orders or get batched differently

2. **Extension Updates Bypass CodeMirror onChange**:
   ```typescript
   // In imagePasteExtension:
   view.dispatch({
     changes: { from, insert: placeholder },
     selection: EditorSelection.cursor(from + placeholder.length),
   })
   onDocChange?.(view.state.doc.toString())  // ⚠️ Sync React separately
   ```
   
   This means React state updates happen AFTER view.dispatch, and they're separate from CodeMirror's onChange, which means React doesn't get the standard change event.

3. **No Guarantee of Consistency**:
   - CodeMirror has the placeholder
   - React state update is enqueued
   - But before React state updates, another change event fires
   - React's `onChange` prop might not sync properly
   - CodeMirror and React become out of sync

---

## Critical Bug #4: Ref Updates Aren't Synchronized

**File:** `apps/playdeck/features/decks/components/deck-editor-workspace.tsx`
**Lines:** 65-71

### The Problem

```typescript
const markdownRef = useRef(markdown)
const lastSavedRef = useRef(lastSavedMarkdown)

useEffect(() => {
  markdownRef.current = markdown
  lastSavedRef.current = lastSavedMarkdown
}, [markdown, lastSavedMarkdown])
```

### Why It's Broken

1. **Refs Update in a Separate Effect**:
   - The autosave effect runs when `markdown` changes
   - But the ref update happens in a different effect
   - React doesn't guarantee which effect runs first
   - So when autosave fires, the refs might be stale

2. **Race Condition**:
   ```
   T=0ms: User pastes image
   T=100ms: Two effects fire:
     - Effect 1 (ref update): markdownRef.current = newMarkdown ✓
     - Effect 2 (autosave scheduler): schedules timeout using markdownRef
     
     BUT: React re-orders effects! What if:
     - Effect 2 runs FIRST, schedules using OLD markdownRef
     - Effect 1 runs NEXT, updates markdownRef
     - T=600ms: Timeout fires, but markdownRef was already captured!
   ```

3. **useEffect Runs AFTER Render**:
   - Component renders with new markdown
   - useEffect queued to update markdownRef
   - But setTimeout was already scheduled
   - Timing is unpredictable

---

## Critical Bug #5: Live Session Snapshot Overwrite

**File:** `apps/playdeck/features/decks/components/present-deck-client.tsx`
**Lines:** 250-257

### The Problem

```typescript
const slidesForPresentation = presenterRevealSlidesFromSources({
  liveMarkdown:
    joinCode !== null && liveSessionSub.$isLoaded
      ? liveSessionSub.markdown  // ⚠️ Frozen snapshot
      : undefined,
  deckViews: views,
})
```

### Why It's Broken

1. **Frozen Markdown in LiveSession**:
   - When presenter goes live, `LiveSession.markdown` is created from CURRENT deck
   - This markdown stays frozen while presenter edits deck
   - Viewers see the frozen version (correct)
   - But if presenter has unsaved image pastes...

2. **Race Condition During Live**:
   ```
   T=0s: Presenter goes live
         LiveSession.markdown = "Slide 1...\n---\nSlide 2..."
   
   T=10s: Presenter pastes image in slide 1
         - User's CodeMirror: "Slide 1...\n![uploading-abc]()...\n---\nSlide 2..."
         - React markdown: "Slide 1...\n![uploading-abc]()...\n---\nSlide 2..."
         - LiveSession.markdown: STILL "Slide 1...\n---\nSlide 2..." (frozen)
   
   T=15s: Upload completes, image resolved
         - React markdown: "Slide 1...\n![](jazz:xyz)...\n---\nSlide 2..."
         - But LiveSession.markdown STILL frozen, so viewers don't see it
         
   T=20s: Presenter ends live
         - Immediately goes back to edit
         - But deck.slides might have already been synced
         - If autosave fired while uploading, both presenter and viewers see image ✓
         - If autosave hasn't fired, no one sees it (image lost)
   ```

3. **Frozen State Persists Even After Save**:
   ```typescript
   // In live-session-mutations.ts, startLiveSession():
   const markdown = slidesToMarkdownDocument(views)
   const liveSession = LiveSession.create({
     markdown,  // ⚠️ Snapshot at start time
     // ... other fields
   })
   ```
   
   This markdown is **never updated** if the presenter edits the deck while live. The deck.slides update, but LiveSession.markdown stays frozen.

---

## Critical Bug #6: Image Upload Callbacks Capture Stale State

**File:** `apps/playdeck/features/decks/components/deck-markdown-editor.tsx`
**Lines:** 64-118

### The Problem

```typescript
const handleFileSelected = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... 
    const insertAt = pendingInsertAtRef.current ?? 0
    // ...
    const view = ...  // ⚠️ DOM query, may be stale
    
    onImageUpload(file).then((result) => {
      const current = view.state.doc.toString()
      if ("error" in result) {
        // ...
        syncParentFromView(next)  // ⚠️ Calls onChange
      } else {
        const next = replaceToken(current, token, result.id, "image")
        // ...
        syncParentFromView(next)  // ⚠️ Calls onChange
      }
    })
  },
  [onImageUpload, value, onChange, syncParentFromView],
)
```

### Why It's Broken

1. **View Reference May Become Invalid**:
   ```typescript
   const editorDom = document.querySelector(".cm-editor") as (HTMLElement & { cmView?: EditorView }) | null
   const view = (editorDom as unknown as { CodeMirror?: { view?: EditorView } })?.CodeMirror?.view
   
   if (!view) {
     // Fallback: just call onImageUpload and insert into the document state
     const token = `uploading-${crypto.randomUUID()}`
     onImageUpload(file).then((result) => {
       if ("id" in result) {
         onChange(value.slice(0, insertAt) + `![image](jazz:${result.id})\n` + value.slice(insertAt))
       }
     })
     return
   }
   ```

   The fallback is **extremely dangerous**:
   - Reads `value` from the dependency (may be stale)
   - Performs string manipulation based on old `insertAt`
   - If the document changed, insertion point is wrong!

2. **Fallback Path Uses Stale Closure**:
   ```typescript
   onChange(value.slice(0, insertAt) + `![image](jazz:${result.id})\n` + value.slice(insertAt))
   ```
   - `value` here is the prop value, captured at function creation
   - If user edited between file selection and upload completion, `value` is stale
   - Insertion point is corrupted

---

## Critical Bug #7: hasPendingImageUpload() Not Reliable

**File:** `apps/playdeck/features/decks/codemirror-image-paste.ts`
**Lines:** 7-11

### The Problem

```typescript
const UPLOADING_TOKEN_RE = /!\[uploading-[^[\]\n()]+\]\(\)/u

export function hasPendingImageUpload(doc: string): boolean {
  return UPLOADING_TOKEN_RE.test(doc)
}
```

### Why It's Broken

1. **Only Detects Placeholder Syntax**:
   - Once placeholder is replaced with `![](jazz:id)`, detection fails
   - But image MIGHT NOT BE FULLY PERSISTED YET
   - Example:
     ```
     T=0ms: hasPendingImageUpload("before\n![uploading-abc]()\nafter") → true ✓
     T=100ms: Upload completes, placeholder replaced
              hasPendingImageUpload("before\n![](jazz:xyz)\nafter") → false ✓
              But Jazz might not have synced yet!
     T=150ms: Autosave reads: hasPendingImageUpload() → false, saves immediately
     T=200ms: Jazz finally syncs the image object
             If there's a sync conflict, the image might be lost
     ```

2. **No Tracking of In-Flight Uploads**:
   - Multiple images might be uploading simultaneously
   - Each has its own promise
   - Once one completes and replaces its token, detection fails for others
   - But other images are STILL uploading
   - Autosave might fire before all uploads complete

---

## Critical Bug #8: Extension Updates Don't Coordinate

**File:** `apps/playdeck/features/decks/codemirror-image-paste.ts` + `codemirror-image-drop.ts`
**Lines:** Multiple locations

### The Problem

Both paste and drop extensions do similar things but independently:

```typescript
// Paste extension (lines 71-90):
onUpload(blob).then((result) => {
  const current = view.state.doc.toString()
  // ... dispatch changes
  onDocChange?.(next)
})

// Drop extension (lines 45-64):
onUpload(file).then((result) => {
  const current = view.state.doc.toString()
  // ... dispatch changes
  onDocChange?.(next)
})
```

### Why It's Broken

1. **No Synchronization**:
   - If user pastes + drops images simultaneously, race conditions multiply
   - Each promise reads `view.state.doc` independently
   - But in between reads, the view might have been updated
   - Token replacement might target wrong placeholder

2. **Example Race**:
   ```
   T=0ms: User pastes image A → token = "uploading-A"
          CodeMirror: "line1\n![uploading-A]()\nline2"
   
   T=0ms: User drops image B → token = "uploading-B"  
          CodeMirror: "line1\n![uploading-A]()\n![uploading-B]()\nline2"
   
   T=1000ms: Upload A completes
            - current = view.state.doc.toString()
            - replaceToken(current, "uploading-A", "id-A", "image")
            - Replaces "uploading-A" with "id-A" ✓
   
   T=1100ms: Upload B completes
            - current = view.state.doc.toString()
            - But wait! The view already changed from T=1000ms
            - current now = "line1\n![](jazz:id-A)\n![uploading-B]()\nline2"
            - replaceToken(current, "uploading-B", "id-B", "image") ✓
            
   BUT: What if timing is:
   
   T=1000ms: Upload A starts dispatch
            - view.dispatch({ changes: { from: 0, to: length, insert: ... } })
            - But doesn't finish immediately
            
   T=1050ms: Upload B fires, reads view.state.doc
            - Gets INCONSISTENT state (halfway through A's dispatch)
            - Might replace wrong token or corrupt document
   ```

---

## Data Flow Diagram (What Should Happen)

```
┌──────────────────────────────────────────────────────────────┐
│ User Action: Paste Image                                     │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ CodeMirror Extension Fires                                   │
│ - Insert placeholder: ![uploading-abc]()                    │
│ - Update CodeMirror view.dispatch()                          │
│ - Call onDocChange()                                         │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ React State Updates                                          │
│ - setMarkdown(newMarkdownWithPlaceholder)                    │
│ - Update markdownRef                                         │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Image Uploads (Async)                                        │
│ - Call onImageUpload(blob)                                   │
│ - Upload to Jazz, get ID                                     │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Upload Completes                                             │
│ - Read CURRENT CodeMirror state                              │
│ - Replace placeholder with ![](jazz:id)                      │
│ - Update CodeMirror view                                     │
│ - Call onDocChange() with updated markdown                   │
│ - React state updates to match                               │
└──────────────────────────────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Autosave Timer (600ms from INITIAL markdown change)          │
│ - Reads markdownRef.current (should be with image)           │
│ - Check hasPendingImageUpload() → false (image was replaced) │
│ - Call replaceSlidesFromMarkdown() with markdown with image  │
│ - Jazz persists the slide with image ✓                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Actual Flow (With Bugs)

```
T=0ms: User pastes image
       CodeMirror updated ✓
       onDocChange() called → setMarkdown() ✓
       markdownRef scheduled for update

T=50ms: markdownRef finally updates to new markdown with placeholder ✓
        autosave useEffect schedules setTimeout (600ms delay)

T=100ms: User types more text
         CodeMirror updated ✓
         setMarkdown() called
         New useEffect dependency runs
         ⚠️ NEW setTimeout scheduled! Original one still pending

T=200ms: Image upload completes
         - readCurrentCodeMirror() → has placeholder ✓
         - replaceToken() works ✓
         - view.dispatch() updates CodeMirror ✓
         - onDocChange() called → setMarkdown() ✓
         - BUT: markdownRef hasn't updated yet (another effect pending)

T=600ms: ORIGINAL setTimeout fires
         - reads markdownRef.current
         - ⚠️ This might be the state BEFORE image upload!
         - Calls replaceSlidesFromMarkdown(OLD_STATE)
         - Jazz syncs OLD slides (no image)
         - Image disappears ❌

T=700ms: New setTimeout from T=100ms fires
         - reads markdownRef.current (now with image)
         - But Jazz already persisted without image
         - Syncs again with image... but too late?
         - Depending on timing, image might be lost
```

---

## Summary of Root Causes

| Bug # | Root Cause | Impact | Severity |
|-------|-----------|--------|----------|
| 1 | Stale closure in setTimeout, dependency on markdown | Autosave saves old state without image | **CRITICAL** |
| 2 | onDocChange closure captures old onChange | Image resolution doesn't update React | **CRITICAL** |
| 3 | CodeMirror updates bypass normal onChange | React state inconsistent with editor | **CRITICAL** |
| 4 | Refs updated in separate effect | Autosave reads stale markdown | **CRITICAL** |
| 5 | LiveSession frozen at start, not updated | Viewers might not see image | **HIGH** |
| 6 | View reference stale, fallback path corrupts | Wrong insertion point for image | **CRITICAL** |
| 7 | Only detects placeholder, not in-flight uploads | Autosave races with uploads | **HIGH** |
| 8 | No coordination between paste/drop handlers | Simultaneous uploads corrupt document | **HIGH** |

---

## Why These Bugs Exist

1. **Three Independent State Sources**: React state, CodeMirror state, and Jazz persistence are not synchronized
2. **Async Upload Handling**: Image uploads are async, but the code doesn't properly coordinate with autosave timing
3. **Refs + Effects Complexity**: Using refs + multiple effects makes it hard to reason about timing
4. **Extension Isolation**: CodeMirror extensions update independently and only notify parent via callback
5. **No Queue or Transaction**: Multiple uploads can be in-flight simultaneously with no coordination
6. **Autosave Heuristics**: hasPendingImageUpload() is too simplistic and doesn't account for timing

---

## Specific Code Locations That Need Investigation

### Autosave Logic
- `deck-editor-workspace.tsx:93-113` - autosave useEffect
- `deck-editor-workspace.tsx:65-71` - ref initialization and update

### Image Upload Coordination
- `codemirror-image-paste.ts:71-90` - paste upload promise
- `codemirror-image-drop.ts:45-64` - drop upload promise  
- `deck-markdown-editor.tsx:64-118` - file input handler

### State Sync
- `deck-markdown-editor.tsx:44-62` - extension setup and onDocChange callbacks
- `deck-editor-workspace.tsx:154-158` - isDirty and hasPendingUploads tracking

### Live Session
- `live-session-mutations.ts:21-58` - startLiveSession creates frozen markdown
- `present-deck-client.tsx:250-257` - presenterRevealSlidesFromSources uses frozen markdown
- `slide-markdown-document.ts:89-99` - presenterRevealSlidesFromSources doesn't update LiveSession

---

## Questions for Debugging

1. **Can you reproduce the exact timing?** When does the image disappear - immediately after paste, after autosave, or after endLive?
2. **What's in the network logs?** Does the Jazz mutation go out without the image, or does the image send separately?
3. **Does it happen with multiple images?** Or just single image?
4. **Does it happen during live?** Or only during editing?
5. **What's the upload time?** If image uploads in <600ms, it might be less likely?

