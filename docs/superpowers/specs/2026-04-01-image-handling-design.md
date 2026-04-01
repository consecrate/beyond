# Image Handling Design

**Date:** 2026-04-01  
**App:** playdeck  
**Status:** Approved — ready for implementation

---

## Overview

Add image support to PlayDeck slide authoring. Authors paste, drag, or type `/image` in the markdown editor; images upload to Jazz storage and render identically in the editor preview, presenter view, and student (follower) view.

---

## Scope

Images appear in **Show slides only** (markdown body rendered as HTML). Question/poll prompts already use `slideMarkdownToSafeHtml` so they get image support for free once the renderer is patched — but authoring images into prompts or answer options is out of scope for v1.

---

## Architecture

### Storage

Images are stored as Jazz `ImageDefinition` CoValues via `createImage()` from `jazz-tools/media`. No external storage (no Supabase, R2, or Vercel Blob). The `ImageDefinition` is owned by `me` at upload time and lives in the Jazz peer network alongside the deck.

### Markdown representation

Jazz images are referenced in markdown as:

```
![alt text](jazz:co_z123abc)
```

External URLs (`https://...`) continue to work unchanged.

### Render pipeline (stays synchronous)

`slideMarkdownToSafeHtml` remains a synchronous function. A custom `marked` image renderer intercepts `jazz:` URLs and outputs a data attribute instead of a `src`:

```html
<!-- input markdown -->
![diagram](jazz:co_z123abc)

<!-- output HTML from marked -->
<img data-jazz-id="co_z123abc" alt="diagram" class="jazz-image" />

<!-- external URLs pass through unchanged -->
<img src="https://example.com/photo.png" alt="photo" />
```

`DOMPurify` allows `data-*` attributes by default — no sanitizer config changes needed.

### Client-side resolution — `useJazzImages` hook

A new React hook scans a container ref for `[data-jazz-id]` elements after render, resolves each to a blob URL via `FileStream.toBlob()`, and patches `img.src` in place. Blob URLs are revoked on cleanup to prevent memory leaks.

```
useJazzImages(containerRef)
  → find all img[data-jazz-id] in container
  → for each: highestResAvailable(imageDef, 960, 700) → FileStream.toBlob() → URL.createObjectURL() → img.src
  → show placeholderDataURL while loading (from ImageDefinition)
  → on load fail: add CSS class for broken-image fallback
  → on cleanup: URL.revokeObjectURL() for all created URLs
```

The hook is a `"use client"` module — guards against SSR with `typeof window !== 'undefined'` check.

### Where the hook is applied

| Component | Where |
|---|---|
| `RevealSlideBody` | Wraps the `dangerouslySetInnerHTML` container |
| `QuestionSlideCard` — prompt area | Wraps the prompt `div` (card and overlay variants) |
| `PollSlideCard` — prompt area | Wraps the prompt `div` (card and overlay variants) |

No other changes to existing render call sites.

---

## Input methods (all v1)

### A — Paste from clipboard (`Ctrl/Cmd+V`)

Implemented as a CodeMirror `EventHandler` extension on the `paste` event.

1. Check `clipboardData.items` for an item with `type.startsWith('image/')`. If none found, let the event propagate normally (don't break text paste).
2. Get `item.getAsFile()` → `Blob`.
3. Insert placeholder `![uploading…]()` at current cursor position.
4. Call `createImage(blob, { owner: me, maxSize: 1024, placeholder: 'blur', progressive: true })`.
5. On success: replace `![uploading…]()` with `![image](jazz:co_z...)`, place cursor inside `![▌](jazz:co_z...)` so author can type alt text.
6. On failure: remove the placeholder line, show a toast error.

### B — Drag & drop from Finder/Explorer

Implemented as a CodeMirror `EventHandler` extension on the `drop` event. CodeMirror's `dropCursor: true` (already enabled) shows the insertion line while dragging.

1. Check `dataTransfer.files` — filter to `type.startsWith('image/')`. If no image files, let event propagate (don't break text drag).
2. For multiple files: process sequentially, insert each on its own line at the drop position.
3. Same upload + placeholder flow as paste (steps 3–6 above).
4. Non-image files in the drop (mixed selection): skip silently, only process images.

### C — `/image` inline command

Implemented as a CodeMirror `keymap` extension watching for `Space` or `Enter` when the current line is exactly `/image`.

1. Detect: current line content === `/image` and key is `Enter` or `Space`.
2. Delete the `/image` text from the editor.
3. Programmatically trigger a hidden `<input type="file" accept="image/*">` click.
4. On file selected: same upload + placeholder flow as paste (steps 3–6 above), inserted at the line where `/image` was typed.
5. On file dialog cancelled: no-op.

---

## Edge cases (all v1)

| # | Case | Handling |
|---|---|---|
| 1 | Paste non-image (PDF, text, zip) | Check MIME type first — if not `image/*`, `return` and let event propagate. Normal text paste unaffected. |
| 2 | Image > 5MB or huge dimensions | `createImage({ maxSize: 1024 })` handles resize automatically before upload. No user prompt. |
| 3 | Multiple images pasted/dropped at once | Loop over files, upload sequentially, insert each placeholder immediately, replace as each resolves. |
| 4 | Drop non-image file | Check MIME type — if not `image/*`, do not prevent default, let CodeMirror handle normally. |
| 5 | Jazz upload fails | `try/catch` around `createImage()`. Remove placeholder line. Show toast: "Image upload failed". |
| 6 | Image added to deck while session is live | `LiveSession.markdown` is frozen at session start — new images won't appear in the live session. Expected behaviour. Document in UI as a known limitation (no code needed). |
| 7 | Jazz image fails to load in `useJazzImages` | `toBlob()` returns `undefined` or throws → add class `jazz-image--failed` → CSS shows grey broken-image box with alt text. Slide does not crash. |
| 8 | Slow Jazz image load | Show `placeholderDataURL` (blur thumbnail generated by `createImage`) as `img.src` immediately while full resolution loads via the hook. Replace when blob resolves. |
| 9 | External URL `![alt](https://...)` | Custom marked renderer only intercepts `href.startsWith('jazz:')`. All other URLs output normal `<img src="...">` — unchanged behaviour. |
| 10 | Image overflow inside Reveal.js (960×700px) | CSS on `.jazz-image` and any markdown-rendered `img`: `max-width: 100%; max-height: 60vh; object-fit: contain; display: block; margin: 0 auto`. Applied globally in slide styles. |
| 11 | Blob URL memory leak | `useJazzImages` `useEffect` cleanup calls `URL.revokeObjectURL()` for every URL created in that render cycle. |
| 12 | SSR in Next.js App Router | `useJazzImages` is in a `"use client"` file. Guard: `if (typeof window === 'undefined') return`. `FileStream`, `URL.createObjectURL`, and DOM queries only run client-side. |

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
| `features/slides/deck-reveal-presenter.tsx` | Apply `useJazzImages` to `RevealSlideBody` container |
| `features/slides/live-reveal-follower.tsx` | Apply `useJazzImages` to `RevealSlideBody` container |
| `features/slides/question-slide-card.tsx` | Apply `useJazzImages` to prompt containers |
| `features/slides/poll-slide-card.tsx` | Apply `useJazzImages` to prompt containers |
| `apps/playdeck/app/globals.css` | Add `.jazz-image` sizing rules and `--failed` fallback styles |

---

## Out of scope (v1)

- Images in question/poll **answer options**
- Image gallery or reuse across slides
- Author ability to resize or reposition images after insertion
- Images added to deck appearing in an already-live session
