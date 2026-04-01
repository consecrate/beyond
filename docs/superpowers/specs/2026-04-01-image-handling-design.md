# Image Handling Design

**Date:** 2026-04-01  
**App:** playdeck  
**Status:** Approved — ready for implementation

---

## Overview

Add image support to PlayDeck slide authoring. Authors paste, drag, or type `/image` in the markdown editor; images upload to Jazz storage and render identically in the editor preview, presenter view, and student (follower) view.

---

## Scope

Images appear in **Show slides, question prompts, and poll prompts** — everywhere `slideMarkdownToSafeHtml` is called and `useJazzImages` will be applied. The hook covers all render sites, so prompt image rendering is included in v1.

**Out of scope for v1:**
- Images in question/poll **answer options**
- Image gallery or reuse across slides
- Author ability to resize or reposition images after insertion
- Images added to deck appearing in an already-live session

---

## Architecture

### Storage & Permissions

Images are stored as Jazz `ImageDefinition` CoValues via `createImage()` from `jazz-tools/media`. No external storage.

Decks and slides in this app are owned by `me` directly — there is no pre-existing shared group. Live sessions solve this by creating `Group.create(me)` + `g.addMember("everyone", "writer")` at session start time. Images must be readable by session followers before a session exists.

**Solution: create a per-image public group at upload time**, following the same pattern as live sessions:

```ts
const imageGroup = Group.create(me)
imageGroup.addMember("everyone", "reader")  // reader is sufficient — followers only read
const image = await createImage(blob, { owner: imageGroup, maxSize: 1024, placeholder: 'blur', progressive: true })
```

This is the only reliable way to ensure any Jazz peer that joins a live session can read the image blobs, without needing to know the session group in advance. No fallback to `me` — if group creation fails, the upload fails.

### Markdown representation

Jazz images are referenced in markdown as:

```
![alt text](jazz:co_z123abc)
```

External URLs (`https://...`) continue to work unchanged.

### Render pipeline (stays synchronous)

`slideMarkdownToSafeHtml` remains a synchronous function. A custom `marked` image renderer intercepts `jazz:` URLs and outputs a data attribute:

```html
<!-- input -->
![diagram](jazz:co_z123abc)

<!-- output -->
<img data-jazz-id="co_z123abc" alt="diagram" class="jazz-image" />

<!-- external URLs pass through unchanged -->
<img src="https://example.com/photo.png" alt="photo" />
```

`DOMPurify` allows `data-*` attributes by default — no sanitizer config changes needed.

### Client-side resolution — `useJazzImages` hook

A `"use client"` React hook. Guards `typeof window === 'undefined'` for SSR safety.

**Full resolution contract:**

```
useJazzImages(containerRef, me)
  1. After render: find all img[data-jazz-id] in container
  2. For each element:
     a. Call ImageDefinition.load(id, { as: me }) to get the CoValue
     b. Set img.src = imageDef.placeholderDataURL immediately (blur placeholder)
     c. Call highestResAvailable(imageDef, 960, 700) → FileStream
     d. Call fileStream.toBlob() → URL.createObjectURL() → img.src
     e. On failure (load returns null OR toBlob returns undefined):
        → add class jazz-image--failed (CSS shows grey broken-image box with alt text)
  3. Subscribe: if Jazz delivers higher-res resolutions later (progressive: true),
     re-run step 2c–d for that element (use Jazz CoValue subscription or re-run effect on imageDef changes)
  4. Cleanup (useEffect return):
     → URL.revokeObjectURL() for all object URLs created in this cycle
```

### Placeholder replacement strategy (per-upload unique token)

To safely replace the uploading placeholder in CodeMirror without ambiguity across concurrent uploads or user edits:

1. At upload start, generate a unique token: `uploading-${crypto.randomUUID()}`
2. Insert `![${token}]()` at the cursor/drop position — record the exact transaction position
3. On success: use CodeMirror `view.dispatch` with a `changeByRange` that finds and replaces the exact token string `![${token}]()` → `![image](jazz:co_z...)`; cursor placed inside alt text brackets
4. On failure: find and delete the exact token string; set error in status bar

This is unambiguous even with multiple concurrent uploads or user edits between start and finish.

### Error feedback

No toast library exists in the app. Upload errors are surfaced via the existing `error` state in `DeckEditorWorkspace` (the status bar at the bottom of the editor). The error clears on the next successful save or upload.

### Where `useJazzImages` is applied

| Component | Container |
|---|---|
| `RevealSlideBody` | Wraps the `dangerouslySetInnerHTML` div |
| `QuestionSlideCard` — prompt area (card + overlay variants) | Wraps all 3 prompt `dangerouslySetInnerHTML` divs |
| `PollSlideCard` — prompt area (card + overlay variants) | Wraps all prompt `dangerouslySetInnerHTML` divs |

---

## Input methods (all v1)

### A — Paste from clipboard (`Ctrl/Cmd+V`)

CodeMirror `EventHandler` extension on the `paste` event.

1. Check `clipboardData.items` for `type.startsWith('image/')`. If none, let event propagate — normal text paste unaffected.
2. `item.getAsFile()` → `Blob`.
3. Generate token `uploading-${crypto.randomUUID()}`. Insert `![${token}]()` at cursor.
4. `createImage(blob, { owner: imageGroup, maxSize: 1024, placeholder: 'blur', progressive: true })`.
5. On success: find+replace token → `![image](jazz:co_z...)`, cursor inside alt text.
6. On failure: find+delete token, set `error` in workspace status bar.

### B — Drag & drop from Finder/Explorer

CodeMirror `EventHandler` extension on the `drop` event. `dropCursor: true` already enabled.

1. Check `dataTransfer.files` filtered to `type.startsWith('image/')`. If no image files, let event propagate.
2. For multiple files: process sequentially — insert each token placeholder immediately at drop position, upload in order, replace each token as it resolves.
3. Non-image files in a mixed drop: skip silently, only process images.
4. Same upload + token replacement flow as paste (steps 3–6 above).

### C — `/image` inline command

CodeMirror `keymap` extension watching `Enter` when current line content === `/image`.

1. On `Enter` with current line === `/image`: delete the `/image` line, record its position.
2. Programmatically click a hidden `<input type="file" accept="image/*">` in `DeckMarkdownEditor`.
3. On file selected: same upload + token flow, inserted at the recorded line position.
4. On file dialog cancelled: no-op (no placeholder inserted yet).

---

## Edge cases (all v1)

| # | Case | Handling |
|---|---|---|
| 1 | Paste non-image (PDF, text, zip) | Check MIME type first — if not `image/*`, `return` and let event propagate. Normal text paste unaffected. |
| 2 | Image > 5MB or huge dimensions | `createImage({ maxSize: 1024 })` resizes automatically before upload. No user prompt. |
| 3 | Multiple images pasted/dropped at once | Loop over files, upload sequentially. Insert each unique token placeholder immediately, replace as each resolves. |
| 4 | Drop non-image file | Check MIME type — if not `image/*`, do not prevent default, let CodeMirror handle normally. |
| 5 | Jazz upload fails | `try/catch` around `createImage()`. Find+delete unique token. Set `error` in workspace status bar via callback prop. |
| 6 | Image added to deck while session is live | `LiveSession.markdown` is frozen at session start — new images won't appear in the live session. Expected behaviour, no code needed. |
| 7 | Jazz image fails to load in `useJazzImages` | `ImageDefinition.load()` returns null or `toBlob()` returns undefined → add class `jazz-image--failed` → CSS shows grey broken-image box with alt text. Slide does not crash. |
| 8 | Slow Jazz image load | Show `placeholderDataURL` (blur thumbnail) as `img.src` immediately. Replace with blob URL when full resolution resolves. |
| 9 | External URL `![alt](https://...)` | Custom marked renderer only intercepts `href.startsWith('jazz:')`. All other URLs output normal `<img src="...">` — unchanged behaviour. |
| 10 | Image overflow inside Reveal.js (960×700px) | CSS on `.jazz-image` and all markdown-rendered `img`: `max-width: 100%; max-height: 60vh; object-fit: contain; display: block; margin: 0 auto`. |
| 11 | Blob URL memory leak | `useJazzImages` cleanup (`useEffect` return) calls `URL.revokeObjectURL()` for every URL created in that cycle. |
| 12 | SSR in Next.js App Router | `useJazzImages` is `"use client"`. Guard: `if (typeof window === 'undefined') return`. All DOM/blob APIs run client-side only. |

---

## Implementation sequence

Given the 1-hour window, implement in this order to fail fast on the critical path:

1. **Permissions proof** — `createImage({ owner: imageGroup })` with per-image public group; verify a separate Jazz agent with no session can `ImageDefinition.load()` the result
2. **`render-slide-markdown.ts`** — custom marked renderer (`jazz:` → `data-jazz-id`)
3. **`useJazzImages` hook** — full resolution + placeholder + cleanup
4. **Apply hook** to `RevealSlideBody` (editor preview + presenter)
5. **Paste handler** — CodeMirror extension with unique token strategy — verify end-to-end: paste → preview shows image
6. **Apply hook** to follower view (`live-reveal-follower.tsx`) — verify follower sees image
7. **Drop handler** + **`/image` command**
8. **Apply hook** to question + poll prompt containers — verify prompt images render in presenter + follower view
9. **CSS** — sizing + `--failed` state
10. **Regression check** — normal text paste, external URL images, existing slides unaffected

## Verification matrix (minimal)

| Scenario | Pass condition |
|---|---|
| Paste image in editor | Placeholder appears, replaced with image in preview |
| Drop single image | Inserted at correct line, renders in preview |
| Drop multiple images | Each inserts sequentially, all render |
| `/image` command | File picker opens, image inserts at correct line |
| Paste non-image file | No insertion, normal paste behaviour preserved |
| Drop non-image file | No insertion, CodeMirror default drop preserved |
| Upload fails (network off) | Token removed, error shown in status bar |
| External URL image | Renders normally, no regression |
| Presenter view | Image visible in Reveal.js slide |
| Follower view | Image visible for student (permissions correct) |
| Question prompt — presenter | Image in prompt renders correctly in presenter view |
| Question prompt — follower | Image in prompt renders correctly in follower/audience view |
| Poll prompt — presenter | Image in prompt renders correctly in presenter view |
| Poll prompt — follower | Image in prompt renders correctly in follower/audience view |
| Slow load | Blur placeholder shown first, replaced by full image |
| Failed load | Grey broken-image box shown, slide stable |
| Memory | No blob URL leaks after navigating away |

---

## New files

| File | Purpose |
|---|---|
| `features/decks/codemirror-image-paste.ts` | CodeMirror extension: paste handler |
| `features/decks/codemirror-image-drop.ts` | CodeMirror extension: drop handler |
| `features/decks/codemirror-image-command.ts` | CodeMirror extension: `/image` keymap |
| `features/slides/use-jazz-images.ts` | Hook: resolves `data-jazz-id` → blob URLs |

## Modified files

| File | Change |
|---|---|
| `features/decks/render-slide-markdown.ts` | Add custom `marked` image renderer for `jazz:` URLs |
| `features/decks/components/deck-markdown-editor.tsx` | Add 3 new CodeMirror extensions + hidden file input |
| `features/decks/components/deck-editor-workspace.tsx` | Pass `error` setter + `deckGroup` down to editor |
| `features/slides/deck-reveal-presenter.tsx` | Apply `useJazzImages` to slide body container |
| `features/slides/live-reveal-follower.tsx` | Apply `useJazzImages` to slide body container |
| `features/slides/question-slide-card.tsx` | Apply `useJazzImages` to all 3 prompt containers |
| `features/slides/poll-slide-card.tsx` | Apply `useJazzImages` to prompt containers |
| `apps/playdeck/app/globals.css` | Add `.jazz-image` sizing and `--failed` fallback styles |
