# PlayDeck State Management - Detailed Flow Diagrams

## Complete State Flow with Race Conditions

### Actor Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ deck-markdown-editor.tsx (Child)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Props:                                                                       │
│  - value: string (from parent)                                              │
│  - onChange: (str) => void (calls parent's setMarkdown)                     │
│  - onImageUpload: (blob) => Promise (calls parent's handleImageUpload)      │
│                                                                              │
│ State:                                                                       │
│  - fileInputRef (hidden input for file upload)                              │
│  - pendingInsertAtRef (position for image insertion)                        │
│                                                                              │
│ Effects:                                                                     │
│  1. imagePasteExtension(onImageUpload, onChange)                            │
│     ├─ Triggered on user paste                                              │
│     ├─ Inserts placeholder ![uploading-X]()                                 │
│     ├─ Calls view.dispatch()                                                │
│     └─ Calls onChange() → setMarkdown()                                     │
│                                                                              │
│  2. imageDropExtension(onImageUpload, onChange)                             │
│     ├─ Triggered on user drag-drop                                          │
│     ├─ Similar to paste handler                                             │
│     └─ Also calls onChange()                                                │
│                                                                              │
│  3. handleFileSelected (file input change)                                  │
│     ├─ Queries DOM for CodeMirror view                                      │
│     ├─ If found: uses view.dispatch()                                       │
│     └─ If not found: uses stale closure fallback ⚠️                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ props: value, onChange, onImageUpload
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│ deck-editor-workspace.tsx (Parent)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ State:                                                                       │
│  - markdown: string (current editor content)                                │
│  - lastSavedMarkdown: string (what was last synced to Jazz)                 │
│  - markdownRef: Ref<string> (cache to avoid stale closure)                  │
│  - lastSavedRef: Ref<string> (cache to avoid stale closure)                 │
│  - pending: boolean (transition state for autosave)                         │
│  - error: string | undefined (error message)                               │
│                                                                              │
│ Effects:                                                                     │
│                                                                              │
│  1. Ref Update Effect (lines 68-71)                                         │
│     When: markdown or lastSavedMarkdown changes                             │
│     Effect:                                                                  │
│       markdownRef.current = markdown                                        │
│       lastSavedRef.current = lastSavedMarkdown                              │
│     ⚠️ PROBLEM: No guarantee this runs before autosave timer fires!         │
│                                                                              │
│  2. Sync from Deck Slides Effect (lines 81-91)                              │
│     When: slidesSyncKey changes (slides from Jazz updated)                  │
│     Effect:                                                                  │
│       if markdownMatchesSlides(markdown, slides) return                     │
│       const next = initialMarkdown(slides)                                  │
│       setMarkdown(next)                                                     │
│       setLastSavedMarkdown(next)                                            │
│     Purpose: Sync React state from Jazz (for collaboration)                 │
│     ⚠️ PROBLEM: Can overwrite user edits if slides sync while uploading!    │
│                                                                              │
│  3. CRITICAL: Autosave Timer Effect (lines 93-113)                          │
│     When: markdown changes (dependency on markdown)                         │
│     Action:                                                                  │
│       1. Check: if markdownRef === lastSavedRef, return (nothing changed)   │
│       2. Schedule: setTimeout(() => {                                       │
│          3. Read: current = markdownRef.current                             │
│          4. Guard: if current === lastSavedRef.current, return              │
│          5. Guard: if hasPendingImageUpload(current), return ⚠️             │
│          6. Persist: replaceSlidesFromMarkdown(me, deckId, current)         │
│          7. Update: lastSavedRef.current = current                          │
│          8. Update: setLastSavedMarkdown(current)                           │
│       }, 600ms) ← AUTOSAVE_MS                                               │
│     ⚠️ PROBLEM #1: Each markdown change creates NEW setTimeout              │
│     ⚠️ PROBLEM #2: Closure captures markdownRef at schedule time            │
│     ⚠️ PROBLEM #3: If upload completes between schedule and fire,           │
│                    markdownRef MIGHT have been reset by sync effect!        │
│                                                                              │
│  4. Cleanup Effect (lines 115-124)                                          │
│     On unmount: save current markdown to Jazz                               │
│     Purpose: Ensure no unsaved work is lost when leaving                    │
│                                                                              │
│  5. EditorStateChange Effect (lines 160-166)                                │
│     When: hasPendingUploads, isDirty, pending changes                       │
│     Action: Calls onEditorStateChange prop (passed to parent workspace)     │
│     Purpose: Notify workspace of editor state for UI updates                │
│                                                                              │
│ Props to child:                                                              │
│  - value: markdown (current React state)                                    │
│  - onChange: setMarkdown (update React state)                               │
│  - onImageUpload: handleImageUpload (uploads to Jazz)                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ props: deckId, slides, onEditorStateChange
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│ deck-markdown-workspace.tsx (Grandparent)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Purpose: Layout + navigation                                                │
│                                                                              │
│ State:                                                                       │
│  - editorState: { isDirty, hasPendingUploads, isSaving }                    │
│                                                                              │
│ Effects:                                                                     │
│  - Updates "Present" button disabled state based on editorState             │
│  - If isDirty or hasPendingUploads or isSaving → button disabled            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Timeline: The Race Condition (Simplified)

```
Timeline: User Pastes Image While Editing

T+0ms: ┌─ User types "hello"
       └─ setMarkdown("hello")
          markdownRef.current = "hello" (pending)

T+10ms: ┌─ Effect runs: mark ref update
        └─ markdownRef.current = "hello" ✓

T+20ms: ┌─ Effect runs: autosave timer scheduled
        │  setTimeout(() => { 
        │    const current = markdownRef.current (= "hello" currently)
        │    replaceSlidesFromMarkdown(current)
        │  }, 600ms)
        └─ Timer #1 scheduled to fire at T+620ms

T+100ms: ┌─ User pastes image
         ├─ Extension inserts placeholder
         ├─ CodeMirror: "hello\n![uploading-abc]()\n"
         └─ setMarkdown("hello\n![uploading-abc]()\n")

T+110ms: ┌─ Effect runs: ref update
         └─ markdownRef.current = "hello\n![uploading-abc]()\n" ✓

T+120ms: ┌─ Effect runs: autosave timer scheduled (AGAIN)
         │  setTimeout(() => { 
         │    const current = markdownRef.current (= "hello\n![uploading-abc]()\n" currently)
         │    replaceSlidesFromMarkdown(current)
         │  }, 600ms)
         └─ Timer #2 scheduled to fire at T+720ms
            ⚠️ Timer #1 STILL PENDING at T+620ms!

T+200ms: ┌─ Image upload completes
         ├─ replaceToken() in extension
         ├─ CodeMirror: "hello\n![](jazz:xyz)\n"
         └─ setMarkdown("hello\n![](jazz:xyz)\n")

T+210ms: ┌─ Effect runs: ref update
         └─ markdownRef.current = "hello\n![](jazz:xyz)\n" ✓

T+220ms: ┌─ Effect runs: autosave timer scheduled (AGAIN)
         │  setTimeout(() => { 
         │    const current = markdownRef.current (= "hello\n![](jazz:xyz)\n" currently)
         │    replaceSlidesFromMarkdown(current)
         │  }, 600ms)
         └─ Timer #3 scheduled to fire at T+820ms
            ⚠️ Timers #1 and #2 STILL PENDING!

T+620ms: ┌─ ⚠️ TIMER #1 FIRES (oldest one)
         ├─ Reads markdownRef.current
         ├─ Current value: "hello\n![](jazz:xyz)\n" ✓ (was updated at T+210ms)
         ├─ BUT WAIT! What if... another edit happened?
         │
         │  Scenario A: No more edits
         │  ├─ hasPendingImageUpload("hello\n![](jazz:xyz)\n") → false ✓
         │  ├─ replaceSlidesFromMarkdown("hello\n![](jazz:xyz)\n")
         │  └─ Jazz syncs WITH IMAGE ✓ (lucky timing!)
         │
         │  Scenario B: User types more text
         │  ├─ T+300ms: User types "!"
         │  ├─ setMarkdown("hello!\n![](jazz:xyz)\n")
         │  ├─ T+310ms: markdownRef.current = "hello!\n![](jazz:xyz)\n"
         │  ├─ T+320ms: New Timer #4 scheduled for T+920ms
         │  ├─ At T+620ms, markdownRef.current = "hello!\n![](jazz:xyz)\n" (has image)
         │  ├─ replaceSlidesFromMarkdown("hello!\n![](jazz:xyz)\n")
         │  └─ Jazz syncs WITH IMAGE ✓
         │
         │  Scenario C: SYNC from deck slides happens
         │  ├─ T+550ms: Jazz notifies React of deck slide changes
         │  ├─ slidesSyncKey triggers effect
         │  ├─ setMarkdown(initialMarkdown(slides)) 
         │  ├─ What if slides don't have the image yet?
         │  ├─ setMarkdown("hello\n") ← IMAGE REMOVED!
         │  ├─ T+560ms: markdownRef.current = "hello\n"
         │  ├─ AT T+620ms: Timer #1 fires
         │  ├─ Reads markdownRef.current = "hello\n" ← NO IMAGE!
         │  ├─ replaceSlidesFromMarkdown("hello\n")
         │  ├─ Jazz syncs WITHOUT IMAGE ❌ IMAGE LOST!
         │  └─ Later, Timer #2 and #3 fire with wrong data
         └─ ⚠️ RACE CONDITION DETECTED!

T+720ms: ┌─ ⚠️ TIMER #2 FIRES
         ├─ markdownRef.current might have changed again
         └─ Could cause duplicate saves or overwrite

T+820ms: ┌─ ⚠️ TIMER #3 FIRES
         ├─ markdownRef.current might have changed again
         └─ Could cause duplicate saves or overwrite
```

## The Real Problem: Multiple Timers

The autosave effect creates a NEW timer every time markdown changes. This means:

1. **Rapid edits** → Multiple timers queued
2. **First timer might read stale state** (captured at schedule time)
3. **By time it fires** → State might have been reset by sync effect
4. **But later timers** → Still use their captured references

Result: **Non-deterministic saves with random timing**

## Image Upload State Machine

```
┌─────────────────────────┐
│ 1. User Pastes Image    │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│ 2. Extension Handler Fires                         │
│  - Generate token: "uploading-abc123"              │
│  - Create placeholder: "![uploading-abc123]()"     │
│  - view.dispatch() updates CodeMirror             │
│  - onDocChange() called                           │
└────────────┬─────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────┐
│ 3. React State Updated                             │
│  - setMarkdown("text\n![uploading-abc123]()\n")   │
│  - markdownRef.current = "text\n![...]...\n"       │
└────────────┬─────────────────────────────────────┘
             │
        ┌────┴─────────────────────────────────────┐
        │                                           │
        ▼                                           ▼
   ┌─────────────────┐  ┌─────────────────────────────────────┐
   │ 4a. Autosave    │  │ 4b. User Edits More                 │
   │    Scheduled    │  │    - More text typed                │
   │                 │  │    - NEW autosave timer scheduled   │
   │                 │  │    - Old timer still pending       │
   └────────┬────────┘  └────────┬─────────────────────────────┘
            │                    │
            ▼                    ▼
   ┌──────────────────────────────────────────────┐
   │ 5. Image Uploads (Async)                     │
   │    - Upload blob to Jazz                     │
   │    - Get back ID: "jazz:xyz"                 │
   └──────────────────┬───────────────────────────┘
                      │
                      ▼
   ┌──────────────────────────────────────────────┐
   │ 6. Upload Promise Resolves                   │
   │    - Read view.state.doc.toString()          │
   │    - replaceToken() swaps placeholder        │
   │    - "![uploading-abc123]()" → "![](jazz:xyz)"
   │    - view.dispatch() updates                 │
   │    - onDocChange() called with new markdown  │
   └──────────────────┬───────────────────────────┘
                      │
                      ▼
   ┌──────────────────────────────────────────────┐
   │ 7. React State Updated Again                 │
   │    - setMarkdown("text\n![](jazz:xyz)\n")    │
   │    - markdownRef.current = new value         │
   │    - NEW autosave timer scheduled (AGAIN)    │
   │    - Old timers still pending ⚠️             │
   └──────────────────┬───────────────────────────┘
                      │
                      ▼
   ┌──────────────────────────────────────────────┐
   │ 8. Autosave Timer Fires (after 600ms)        │
   │    - hasPendingImageUpload() check           │
   │    - replaceSlidesFromMarkdown(current)      │
   │    ⚠️ What value is 'current'?               │
   │                                              │
   │    If Jazz sync happened:                    │
   │    └─ markdownRef reset to old value         │
   │       OLD TIMER uses OLD markdown (no image) │
   │       Saves old state → IMAGE LOST! ❌      │
   │                                              │
   │    If no sync:                               │
   │    └─ markdownRef has image                  │
   │       Save works ✓                           │
   └──────────────────────────────────────────────┘
```

## The Dependency Chain Problem

```
Effect Dependencies vs. When They Run:

deck-editor-workspace.tsx:

useEffect(() => {
  markdownRef.current = markdown
  lastSavedRef.current = lastSavedMarkdown
}, [markdown, lastSavedMarkdown])
     ↑
     └─ Runs when markdown OR lastSavedMarkdown changes


useEffect(() => {
  if (!markdownMatchesSlides(markdown, slides)) return
  setMarkdown(...)
  setLastSavedMarkdown(...)
}, [slidesSyncKey, slides, markdown, lastSavedMarkdown])
   ↑
   └─ Runs when ANY of these change
      ⚠️ PROBLEM: Can trigger setMarkdown while autosave is pending!


useEffect(() => {
  const t = setTimeout(() => {
    const current = markdownRef.current  ← Reads ref, not dependency
    // ...
    replaceSlidesFromMarkdown(me, deckId, current)
  }, 600)
  return () => clearTimeout(t)
}, [markdown, deckId, me])
   ↑
   └─ Runs when markdown, deckId, or me changes
      ⚠️ PROBLEM: Creates new timer each time, old ones still pending
      ⚠️ PROBLEM: New timer might fire while old one is about to fire
      ⚠️ PROBLEM: markdownRef captured at SCHEDULE time, not READ time
```

## State Synchronization: A Flowchart

```
                    USER INPUT
                        │
                ┌───────┴───────┐
                ▼               ▼
            PASTE          TYPE TEXT
                │               │
                ├───┬───────────┤
                │   │           │
                ▼   ▼           ▼
            CodeMirror Internal State
            (view.state.doc)
                    │
                    ▼
            Extension Handlers
            (imagePasteExtension,
             imageDropExtension,
             normal onChange)
                    │
                    ▼
            onDocChange() or onChange()
            calls syncParentFromView()
            or direct setMarkdown()
                    │
                    ▼
            React State: markdown
            ┌───────────────────────┐
            │ setMarkdown(newValue)  │
            └───────────────────────┘
                    │
                    ▼
            useEffect hook runs
            (dependencies: markdown, lastSavedMarkdown)
                    │
                    ├─────────────────────────────────┐
                    ▼                                 ▼
            Update Refs              ⚠️ Schedule Autosave
            markdownRef.current      setTimeout(..., 600ms)
            lastSavedRef.current          │
                    │                     ▼
                    │            ┌─────────────────┐
                    │            │ WAIT 600ms      │
                    │            │ (or until new   │
                    │            │  markdown       │
                    │            │  change)        │
                    │            └────────┬────────┘
                    │                     ▼
                    └─────────────────► replaceSlidesFromMarkdown()
                                            │
                                            ▼
                                      Jazz Persistence
                                      (Deck.slides updated)
                                            │
                    ┌───────────────────────┘
                    ▼
            ⚠️ Jazz Change Notification
            slidesSyncKey updates
                    │
                    ▼
            markdownMatchesSlides()
            check if need sync
                    │
            ┌───────┴───────┐
            │ YES           │ NO
            │ MISMATCH      │ MATCH
            ▼               ▼
        setMarkdown()   (do nothing)
        (RESET REACT     (keep current
         STATE!)         React state)
            │
            ▼
        ⚠️ If autosave timer was pending,
           markdownRef.current now changed!
           Next timer might read old value!
```

## Jazz State Sync Interference

```
Timeline showing how Jazz sync interferes with image paste:

T=0ms: User pastes image
       React: markdown = "text\n![uploading-abc]()\n"
       Jazz: Deck.slides = ["text"] (old)

T=100ms: Image upload starts

T=200ms: Image upload completes
       React: markdown = "text\n![](jazz:xyz)\n"
       Jazz: Deck.slides = ["text"] (STILL OLD!)
       ⚠️ Jazz hasn't synced yet!

T=250ms: Autosave #1 fires (600ms from initial paste)
       Reads: markdownRef.current = "text\n![](jazz:xyz)\n" ✓
       Calls: replaceSlidesFromMarkdown()
       Jazz: Deck.slides = ["text\n![](jazz:xyz)\n"] ✓ (WITH IMAGE)

T=300ms: Jazz replication catches up
       Old state might have propagated
       Jazz: Receives "text" (old) from another source?
       slidesSyncKey triggers
       markdownMatchesSlides("text\n![](jazz:xyz)\n", ["text"]) → FALSE
       setMarkdown("text") ← IMAGE REMOVED!
       React: markdown = "text" ❌

T=350ms: Autosave #2 fires (or new timer)
       Reads: markdownRef.current = "text"
       Calls: replaceSlidesFromMarkdown()
       Jazz: Deck.slides = ["text"] ❌ IMAGE PERMANENTLY LOST!
```

This is why the image "disappears" even though it was successfully uploaded to Jazz!
