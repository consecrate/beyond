# Image Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image support to PlayDeck: paste/drop/`/image` in the markdown editor uploads to Jazz, renders in editor preview, presenter view, follower view, and poll prompts.

**Architecture:** Images are stored as Jazz `ImageDefinition` CoValues, each owned by a per-image public `Group` (so followers can read without a session group). The markdown stores `![alt](jazz:co_z...)` references. A custom `marked` renderer turns them into `<img data-jazz-id="...">` at render time; a `useJazzImages` React hook resolves those elements into blob URLs client-side.

**Tech Stack:** TypeScript, React (Next.js App Router), Jazz (`jazz-tools` v0.20.15), CodeMirror 6, `marked`, Vitest + jsdom.

**Run tests:** `pnpm test` (from repo root) or `cd apps/playdeck && pnpm test`

---

## File Map

**New files:**
- `apps/playdeck/features/decks/render-slide-markdown.test.ts` — tests for jazz: renderer
- `apps/playdeck/features/slides/use-jazz-images.ts` — hook: resolves `data-jazz-id` → blob URLs
- `apps/playdeck/features/decks/codemirror-image-paste.ts` — CM6 extension: paste handler
- `apps/playdeck/features/decks/codemirror-image-paste.test.ts` — tests for paste token logic
- `apps/playdeck/features/decks/codemirror-image-drop.ts` — CM6 extension: drop handler
- `apps/playdeck/features/decks/codemirror-image-command.ts` — CM6 extension: `/image` keymap

**Modified files:**
- `apps/playdeck/features/decks/render-slide-markdown.ts` — add jazz: image renderer
- `apps/playdeck/features/decks/components/deck-markdown-editor.tsx` — add 3 extensions + hidden file input
- `apps/playdeck/features/decks/components/deck-editor-workspace.tsx` — pass `me` + `setError` to editor
- `apps/playdeck/features/slides/deck-reveal-presenter.tsx` — apply `useJazzImages` to `RevealSlideBody`
- `apps/playdeck/features/slides/live-reveal-follower.tsx` — apply `useJazzImages` via `RevealSlideBody` (already shared)
- `apps/playdeck/features/slides/poll-slide-card.tsx` — apply `useJazzImages` to prompt containers
- `apps/playdeck/app/globals.css` — `.jazz-image` sizing + `--failed` state

---

## Task 1: Custom `marked` renderer for `jazz:` URLs

**Files:**
- Modify: `apps/playdeck/features/decks/render-slide-markdown.ts`
- Create: `apps/playdeck/features/decks/render-slide-markdown.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/playdeck/features/decks/render-slide-markdown.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"

describe("slideMarkdownToSafeHtml — jazz: images", () => {
  it("converts jazz: image to data-jazz-id img", () => {
    const html = slideMarkdownToSafeHtml("![a diagram](jazz:co_z1abc)")
    expect(html).toContain('data-jazz-id="co_z1abc"')
    expect(html).toContain('alt="a diagram"')
    expect(html).toContain('class="jazz-image"')
    expect(html).not.toContain('src="jazz:')
  })

  it("leaves external URLs unchanged", () => {
    const html = slideMarkdownToSafeHtml("![photo](https://example.com/img.png)")
    expect(html).toContain('src="https://example.com/img.png"')
    expect(html).not.toContain("data-jazz-id")
  })

  it("leaves relative URLs unchanged", () => {
    const html = slideMarkdownToSafeHtml("![icon](/icons/star.svg)")
    expect(html).toContain('src="/icons/star.svg"')
    expect(html).not.toContain("data-jazz-id")
  })

  it("preserves normal text around jazz image", () => {
    const html = slideMarkdownToSafeHtml("Hello\n\n![x](jazz:co_z2)\n\nWorld")
    expect(html).toContain("Hello")
    expect(html).toContain("World")
    expect(html).toContain('data-jazz-id="co_z2"')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/playdeck && pnpm test render-slide-markdown
```

Expected: 4 failures (jazz: URL still passed through as `src`).

- [ ] **Step 3: Implement the custom renderer**

Edit `apps/playdeck/features/decks/render-slide-markdown.ts`:

```ts
import DOMPurify from "isomorphic-dompurify"
import { marked, type Renderer } from "marked"

marked.setOptions({ gfm: true, breaks: true })

const renderer: Partial<Renderer> = {
  image({ href, text }) {
    if (href?.startsWith("jazz:")) {
      const id = href.slice("jazz:".length)
      return `<img data-jazz-id="${id}" alt="${text ?? ""}" class="jazz-image" />`
    }
    // Fall through to default rendering for all other URLs
    return false
  },
}

marked.use({ renderer })

export function slideMarkdownToSafeHtml(markdown: string): string {
  const src = markdown.trim() === "" ? "<p></p>" : markdown
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-jazz-id"] })
}
```

> Note: `DOMPurify.sanitize` strips unknown attributes by default. `ADD_ATTR: ["data-jazz-id"]` allows it through.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/playdeck && pnpm test render-slide-markdown
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/playdeck/features/decks/render-slide-markdown.ts \
        apps/playdeck/features/decks/render-slide-markdown.test.ts
git commit -m "feat: add marked renderer for jazz: image URLs → data-jazz-id"
```

---

## Task 2: `useJazzImages` hook

**Files:**
- Create: `apps/playdeck/features/slides/use-jazz-images.ts`

This hook scans a container for `img[data-jazz-id]` elements and resolves each one to a blob URL using `loadImageBySize` from `jazz-tools/media`. It re-runs whenever `imageDefs` changes (Jazz pushes progressive resolutions). It cleans up object URLs on unmount.

> **No test for this task** — it requires Jazz peer infrastructure (Jazz CoValues, local node) that cannot be set up in jsdom. The hook is verified manually in Task 4 (end-to-end paste → preview).

- [ ] **Step 1: Create the hook**

Create `apps/playdeck/features/slides/use-jazz-images.ts`:

```ts
"use client"

import { useEffect, useRef } from "react"
import { ImageDefinition } from "jazz-tools"
import { loadImageBySize } from "jazz-tools/media"
import type { Loaded } from "jazz-tools"
import type { PlaydeckAccount } from "@/features/jazz/schema"

const REVEAL_WIDTH = 960
const REVEAL_HEIGHT = 700

/**
 * Resolves all `<img data-jazz-id="co_z...">` elements inside `containerRef`
 * to blob URLs using Jazz progressive image loading.
 *
 * Must be called in a "use client" component.
 * Safe to call on SSR — guards `typeof window === 'undefined'`.
 */
export function useJazzImages(
  containerRef: React.RefObject<HTMLElement | null>,
  me: Loaded<typeof PlaydeckAccount> | null | undefined,
) {
  // Track object URLs for cleanup
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!me?.$isLoaded) return

    const container = containerRef.current
    if (!container) return

    const elements = Array.from(
      container.querySelectorAll<HTMLImageElement>("img[data-jazz-id]"),
    )
    if (elements.length === 0) return

    let cancelled = false

    async function resolveImages() {
      for (const img of elements) {
        if (cancelled) break

        const id = img.dataset.jazzId
        if (!id) continue

        try {
          // Load ImageDefinition — resolves with full CoValue including progressive sizes
          const imageDef = await ImageDefinition.load(id, {
            resolve: { original: true },
          })

          if (cancelled) break
          if (!imageDef) {
            img.classList.add("jazz-image--failed")
            continue
          }

          // Show blur placeholder immediately while full res loads
          if (imageDef.placeholderDataURL) {
            img.src = imageDef.placeholderDataURL
          }

          // Load best resolution for Reveal.js viewport (960×700)
          const result = await loadImageBySize(imageDef, REVEAL_WIDTH, REVEAL_HEIGHT)

          if (cancelled) break

          if (!result) {
            // No resolution available yet — placeholder stays, no failure
            continue
          }

          const blob = result.image.toBlob()
          if (!blob) {
            img.classList.add("jazz-image--failed")
            continue
          }

          const url = URL.createObjectURL(blob)
          objectUrlsRef.current.push(url)
          img.src = url
          img.classList.remove("jazz-image--failed")
        } catch {
          if (!cancelled) {
            img.classList.add("jazz-image--failed")
          }
        }
      }
    }

    resolveImages()

    return () => {
      cancelled = true
      // Revoke all object URLs created in this cycle
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      objectUrlsRef.current = []
    }
  // Re-run when container contents change or me loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, me?.$isLoaded])
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep use-jazz-images
```

Expected: no errors related to `use-jazz-images.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/playdeck/features/slides/use-jazz-images.ts
git commit -m "feat: add useJazzImages hook for resolving data-jazz-id to blob URLs"
```

---

## Task 3: Apply `useJazzImages` to `RevealSlideBody`

**Files:**
- Modify: `apps/playdeck/features/slides/deck-reveal-presenter.tsx`

`RevealSlideBody` renders `dangerouslySetInnerHTML` for show slides. We add a `ref` to the div and call `useJazzImages`. `me` is not currently in scope here — we need to pass it down or use `useAccount`.

- [ ] **Step 1: Add `useAccount` and `useJazzImages` to `RevealSlideBody`**

In `apps/playdeck/features/slides/deck-reveal-presenter.tsx`, find `RevealSlideBody` (around line 64) and update it:

```tsx
// Add to imports at top of file (existing import from jazz-tools/react already present via useAccount in parent — add here):
import { useAccount } from "jazz-tools/react"
import { useRef } from "react"  // already imported — just confirm it's there
import { useJazzImages } from "@/features/slides/use-jazz-images"
import { PlaydeckAccount } from "@/features/jazz/schema"

// Replace RevealSlideBody:
export function RevealSlideBody({
  slide,
  slideIndex,
  activeIndex,
}: {
  slide: RevealSlideModel
  slideIndex: number
  activeIndex: number
}) {
  const show = Math.abs(slideIndex - activeIndex) <= LAZY_RADIUS
  const containerRef = useRef<HTMLDivElement>(null)
  const { me } = useAccount(PlaydeckAccount)

  useJazzImages(containerRef, me)

  if (slide.poll || slide.question || slide.interactiveError) {
    return (
      <div className="h-0 w-0 overflow-hidden opacity-0" aria-hidden />
    )
  }

  if (!show) {
    return (
      <div
        className="flex min-h-[min(70vh,700px)] w-full max-w-4xl items-center justify-center"
        aria-hidden
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  const inner =
    slide.html.trim() === ""
      ? '<p class="text-muted-foreground">Empty slide</p>'
      : slide.html

  return (
    <div
      ref={containerRef}
      className="prose prose-invert max-h-[min(70vh,700px)] w-full max-w-4xl overflow-auto px-2 text-left prose-headings:font-semibold prose-p:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}
```

> Note: `useAccount` is already used in `DeckRevealPresenter` (the parent); importing it a second time in `RevealSlideBody` is fine — hooks are per component instance.

- [ ] **Step 2: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep -E "deck-reveal-presenter|use-jazz"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playdeck/features/slides/deck-reveal-presenter.tsx
git commit -m "feat: apply useJazzImages to RevealSlideBody for show slides"
```

---

## Task 4: CSS for `.jazz-image` sizing and `--failed` state

**Files:**
- Modify: `apps/playdeck/app/globals.css`

- [ ] **Step 1: Add CSS rules**

Open `apps/playdeck/app/globals.css` and append at the end:

```css
/* Jazz image rendering — applied to all img[data-jazz-id] via the jazz-image class */
.jazz-image {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

/* Fallback when Jazz image fails to load */
.jazz-image--failed {
  display: inline-block;
  min-width: 120px;
  min-height: 80px;
  background-color: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  position: relative;
}

.jazz-image--failed::after {
  content: attr(alt);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  padding: 0.5rem;
  text-align: center;
}
```

- [ ] **Step 2: Verify dev server compiles**

```bash
pnpm dev
```

Expected: server starts with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playdeck/app/globals.css
git commit -m "feat: add jazz-image CSS sizing and failed state fallback"
```

---

## Task 5: Paste handler CodeMirror extension

**Files:**
- Create: `apps/playdeck/features/decks/codemirror-image-paste.ts`
- Create: `apps/playdeck/features/decks/codemirror-image-paste.test.ts`

The paste handler needs a `createUploadFn` callback (injected from the editor) that does the actual Jazz upload. This keeps the extension testable without Jazz.

- [ ] **Step 1: Write failing tests for the token replacement utilities**

Create `apps/playdeck/features/decks/codemirror-image-paste.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { replaceToken, deleteToken } from "@/features/decks/codemirror-image-paste"

describe("replaceToken", () => {
  it("replaces the placeholder token with a jazz: URL", () => {
    const doc = "before\n![uploading-abc123]()\nafter"
    const result = replaceToken(doc, "uploading-abc123", "co_z1abc", "diagram")
    expect(result).toBe("before\n![diagram](jazz:co_z1abc)\nafter")
  })

  it("handles token at start of document", () => {
    const doc = "![uploading-xyz]()\nsome text"
    const result = replaceToken(doc, "uploading-xyz", "co_z2", "")
    expect(result).toBe("![](jazz:co_z2)\nsome text")
  })

  it("only replaces first occurrence if somehow duplicated", () => {
    const doc = "![uploading-tok]()\n![uploading-tok]()"
    const result = replaceToken(doc, "uploading-tok", "co_z3", "img")
    // replaces only first
    expect(result).toBe("![img](jazz:co_z3)\n![uploading-tok]()")
  })
})

describe("deleteToken", () => {
  it("removes the placeholder token line", () => {
    const doc = "line one\n![uploading-abc]()\nline three"
    const result = deleteToken(doc, "uploading-abc")
    expect(result).toBe("line one\nline three")
  })

  it("handles token only content", () => {
    const doc = "![uploading-only]()"
    const result = deleteToken(doc, "uploading-only")
    expect(result).toBe("")
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd apps/playdeck && pnpm test codemirror-image-paste
```

Expected: fails (module not found).

- [ ] **Step 3: Create the extension**

Create `apps/playdeck/features/decks/codemirror-image-paste.ts`:

```ts
import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

export type ImageUploadFn = (blob: Blob) => Promise<{ id: string } | { error: string }>

/**
 * Replace `![uploading-<token>]()` with `![alt](jazz:<id>)` in a plain string.
 * Only replaces the first occurrence.
 */
export function replaceToken(doc: string, token: string, id: string, alt: string): string {
  return doc.replace(`![${token}]()`, `![${alt}](jazz:${id})`)
}

/**
 * Remove `![uploading-<token>]()` (and its surrounding newline if it's on its own line).
 */
export function deleteToken(doc: string, token: string): string {
  // Try to remove the whole line
  const linePattern = new RegExp(`\\n?!\\[${token}\\]\\(\\)\\n?`)
  const withLine = doc.replace(linePattern, (match) => {
    // Preserve one newline if there were two
    if (match.startsWith("\n") && match.endsWith("\n")) return "\n"
    return ""
  })
  if (withLine !== doc) return withLine
  // Fallback: remove inline occurrence
  return doc.replace(`![${token}]()`, "")
}

/**
 * CodeMirror extension that intercepts paste events containing image files.
 * Non-image pastes are not intercepted — normal paste behaviour is preserved.
 *
 * @param onUpload - async function that uploads a Blob and returns `{ id }` or `{ error }`
 */
export function imagePasteExtension(onUpload: ImageUploadFn): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      paste(event, view) {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageItems = items.filter((item) => item.type.startsWith("image/"))
        if (imageItems.length === 0) return false // let normal paste proceed

        event.preventDefault()

        for (const item of imageItems) {
          const blob = item.getAsFile()
          if (!blob) continue

          const token = `uploading-${crypto.randomUUID()}`
          const placeholder = `![${token}]()`

          // Insert placeholder at current cursor
          const { from } = view.state.selection.main
          view.dispatch({
            changes: { from, insert: placeholder },
            selection: EditorSelection.cursor(from + placeholder.length),
          })

          onUpload(blob).then((result) => {
            const current = view.state.doc.toString()
            if ("error" in result) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: deleteToken(current, token) },
              })
              return
            }
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: replaceToken(current, token, result.id, "image"),
              },
            })
          })
        }

        return true
      },
    }),
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/playdeck && pnpm test codemirror-image-paste
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/playdeck/features/decks/codemirror-image-paste.ts \
        apps/playdeck/features/decks/codemirror-image-paste.test.ts
git commit -m "feat: CodeMirror image paste extension with unique-token placeholder strategy"
```

---

## Task 6: Drop handler CodeMirror extension

**Files:**
- Create: `apps/playdeck/features/decks/codemirror-image-drop.ts`

Same `ImageUploadFn` contract, same token strategy. Handles multiple files sequentially.

- [ ] **Step 1: Create the extension**

Create `apps/playdeck/features/decks/codemirror-image-drop.ts`:

```ts
import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import type { ImageUploadFn } from "@/features/decks/codemirror-image-paste"
import { deleteToken, replaceToken } from "@/features/decks/codemirror-image-paste"

/**
 * CodeMirror extension that handles dropping image files into the editor.
 * Non-image drops (text, non-image files) are not intercepted.
 * Multiple image files are processed sequentially.
 *
 * @param onUpload - async function that uploads a Blob and returns `{ id }` or `{ error }`
 */
export function imageDropExtension(onUpload: ImageUploadFn): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      drop(event, view) {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const imageFiles = files.filter((f) => f.type.startsWith("image/"))
        if (imageFiles.length === 0) return false // let CM handle normal drops

        event.preventDefault()

        // Resolve drop position from coordinates
        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length

        let insertOffset = dropPos

        for (const file of imageFiles) {
          const token = `uploading-${crypto.randomUUID()}`
          const placeholder = `![${token}]()\n`

          const pos = insertOffset
          view.dispatch({
            changes: { from: pos, insert: placeholder },
            selection: EditorSelection.cursor(pos + placeholder.length),
          })
          insertOffset += placeholder.length

          onUpload(file).then((result) => {
            const current = view.state.doc.toString()
            if ("error" in result) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: deleteToken(current, token) },
              })
              return
            }
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: replaceToken(current, token, result.id, "image"),
              },
            })
          })
        }

        return true
      },
    }),
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep codemirror-image-drop
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playdeck/features/decks/codemirror-image-drop.ts
git commit -m "feat: CodeMirror image drop extension with unique-token placeholder strategy"
```

---

## Task 7: `/image` command CodeMirror extension

**Files:**
- Create: `apps/playdeck/features/decks/codemirror-image-command.ts`

Intercepts `Enter` when the current line is exactly `/image`. Deletes the line, then calls a provided `onTrigger` callback. The callback (in the editor component) programmatically opens a file picker.

- [ ] **Step 1: Create the extension**

Create `apps/playdeck/features/decks/codemirror-image-command.ts`:

```ts
import { Prec, type Extension } from "@codemirror/state"
import { keymap, type EditorView } from "@codemirror/view"

/**
 * CodeMirror extension: pressing Enter on a line that contains exactly `/image`
 * deletes that line and calls `onTrigger(lineFrom)` with the position of the deleted line.
 * The caller is responsible for opening a file picker and inserting the image at that position.
 */
export function imageCommandExtension(onTrigger: (insertAt: number) => void): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: "Enter",
        run(view: EditorView) {
          const { state } = view
          const { from } = state.selection.main
          const line = state.doc.lineAt(from)
          if (line.text.trim() !== "/image") return false

          // Delete the /image line (including newline if not first line)
          const deleteFrom = line.number > 1 ? line.from - 1 : line.from
          const deleteTo = line.to
          view.dispatch({
            changes: { from: deleteFrom, to: deleteTo, insert: "" },
          })

          const insertAt = deleteFrom

          // Defer so the editor updates before the file dialog opens
          setTimeout(() => onTrigger(insertAt), 0)

          return true
        },
      },
    ]),
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep codemirror-image-command
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/playdeck/features/decks/codemirror-image-command.ts
git commit -m "feat: CodeMirror /image command extension that triggers file picker"
```

---

## Task 8: Wire extensions into `DeckMarkdownEditor` and upload logic into `DeckEditorWorkspace`

**Files:**
- Modify: `apps/playdeck/features/decks/components/deck-editor-workspace.tsx`
- Modify: `apps/playdeck/features/decks/components/deck-markdown-editor.tsx`

The upload function needs `me` from Jazz. It lives in `DeckEditorWorkspace` (which already has `useAccount`). We pass it down as a callback prop to `DeckMarkdownEditor`.

- [ ] **Step 1: Add upload callback prop to `DeckMarkdownEditor`**

Edit `apps/playdeck/features/decks/components/deck-markdown-editor.tsx`:

```tsx
"use client"

import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { useTheme } from "next-themes"
import { useCallback, useMemo, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"

import { cn } from "@beyond/design-system"

import { markdownFormattingKeymap } from "@/features/decks/codemirror-markdown-formatting"
import { imagePasteExtension, imageDropExtension, deleteToken, replaceToken, type ImageUploadFn } from "@/features/decks/codemirror-image-paste"
import { imageDropExtension } from "@/features/decks/codemirror-image-drop"
import { imageCommandExtension } from "@/features/decks/codemirror-image-command"

type Props = {
  value: string
  onChange: (value: string) => void
  onImageUpload: ImageUploadFn
  className?: string
}

export function DeckMarkdownEditor({ value, onChange, onImageUpload, className }: Props) {
  const { resolvedTheme } = useTheme()
  const themeExt = useMemo(
    () => (resolvedTheme === "dark" ? githubDark : githubLight),
    [resolvedTheme],
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingInsertAtRef = useRef<number | null>(null)

  const handleImageCommand = useCallback((insertAt: number) => {
    pendingInsertAtRef.current = insertAt
    fileInputRef.current?.click()
  }, [])

  const handleFileSelectedWithView = useCallback(
    () => [
      markdown(),
      EditorView.lineWrapping,
      themeExt,
      markdownFormattingKeymap,
      imagePasteExtension(onImageUpload),
      imageDropExtension(onImageUpload),
      imageCommandExtension(handleImageCommand),
    ],
    [themeExt, onImageUpload, handleImageCommand],
  )

  const handleFileSelectedWithView = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return

      const insertAt = pendingInsertAtRef.current ?? 0
      pendingInsertAtRef.current = null

      const view = (fileInputRef as React.MutableRefObject<HTMLInputElement & { _cmView?: EditorView }>)
        .current?._cmView
      if (!view) return

      const token = `uploading-${crypto.randomUUID()}`
      const placeholder = `![${token}]()\n`

      view.dispatch({
        changes: { from: insertAt, insert: placeholder },
      })

      onImageUpload(file).then((result) => {
        const current = view.state.doc.toString()
        if ("error" in result) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: deleteToken(current, token) },
          })
          return
        }
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: replaceToken(current, token, result.id, "image"),
          },
        })
      })
    },
    [onImageUpload],
  )

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelectedWithView}
        aria-hidden
      />
      <CodeMirror
        theme="none"
        value={value}
        height="100%"
        className="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:flex [&_.cm-editor]:min-h-0 [&_.cm-editor]:h-full [&_.cm-editor]:flex-col [&_.cm-scroller]:h-full [&_.cm-scroller]:min-h-[260px]"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
        }}
      />
    </div>
  )
}
```

> **Note on the `/image` + view ref approach:** The `_cmView` trick attaches the CM view to the file input's DOM node so `handleFileSelectedWithView` can access it. This is an intentional pragmatic choice to avoid prop-drilling the view ref through CodeMirror's render boundary. If you find this too hacky, an alternative is to use `useImperativeHandle` on a `DeckMarkdownEditor` ref — but the current approach works correctly.

- [ ] **Step 2: Add `onImageUpload` to `DeckEditorWorkspace`**

In `apps/playdeck/features/decks/components/deck-editor-workspace.tsx`, add the upload callback and pass it to `DeckMarkdownEditor`. Find the existing `DeckMarkdownEditor` usage and surrounding `me` setup:

Add import at top:

```ts
import { Group } from "jazz-tools"
import { createImage } from "jazz-tools/media"
import type { ImageUploadFn } from "@/features/decks/codemirror-image-paste"
```

Add the callback inside `DeckEditorWorkspace` (after the existing `useAccount` call):

```ts
const handleImageUpload: ImageUploadFn = useCallback(
  async (blob) => {
    try {
      const imageGroup = Group.create(me)
      imageGroup.addMember("everyone", "reader")
      const image = await createImage(blob, {
        owner: imageGroup,
        maxSize: 1024,
        placeholder: "blur",
        progressive: true,
      })
      return { id: image.$jazz.id }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setError(msg)
      return { error: msg }
    }
  },
  [me, setError],
)
```

Then update the `DeckMarkdownEditor` JSX call (add `onImageUpload`):

```tsx
<DeckMarkdownEditor
  className="h-full min-h-[200px]"
  value={markdown}
  onChange={setMarkdown}
  onImageUpload={handleImageUpload}
/>
```

- [ ] **Step 3: Add `useCallback` to imports in workspace**

`useCallback` needs to be added to the existing React import in `deck-editor-workspace.tsx`. The current import is:

```ts
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
```

Add `useCallback`:

```ts
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep -E "deck-markdown-editor|deck-editor-workspace"
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test — paste image**

1. `pnpm dev` → open `http://localhost:3000`
2. Open a deck editor
3. Copy an image to clipboard (screenshot or right-click image in browser → copy)
4. Paste into the editor (`Cmd+V`)

Expected:
- `![uploading-<uuid>]()` appears briefly
- Replaced by `![image](jazz:co_z...)` after upload
- Preview panel shows the image

- [ ] **Step 6: Commit**

```bash
git add apps/playdeck/features/decks/components/deck-markdown-editor.tsx \
        apps/playdeck/features/decks/components/deck-editor-workspace.tsx
git commit -m "feat: wire image paste/drop/command extensions and upload to Jazz"
```

---

## Task 9: Apply `useJazzImages` to `PollSlideCard` prompt containers

**Files:**
- Modify: `apps/playdeck/features/slides/poll-slide-card.tsx`

There are 3 `dangerouslySetInnerHTML` prompt render points in `poll-slide-card.tsx`:
1. `InlineMd` component (line 14) — used for option text, not the main prompt
2. `AudienceTheaterPollPrompt` (line 86) — the audience full-screen prompt
3. Inline `dangerouslySetInnerHTML` inside the card/overlay variant (line 404)

We need `useJazzImages` on the outer containers of 2 and 3. `InlineMd` is used for option labels, not prompts — leave it alone.

- [ ] **Step 1: Add imports to `poll-slide-card.tsx`**

Add to the top of `apps/playdeck/features/slides/poll-slide-card.tsx`:

```ts
import { useRef } from "react"
import { useAccount } from "jazz-tools/react"
import { PlaydeckAccount } from "@/features/jazz/schema"
import { useJazzImages } from "@/features/slides/use-jazz-images"
```

> `useMemo` and `useState` are already imported; add `useRef` to that line.

- [ ] **Step 2: Update `AudienceTheaterPollPrompt`**

Find `AudienceTheaterPollPrompt` (~line 72) and update it to add a ref and call the hook:

```tsx
function AudienceTheaterPollPrompt({ block }: { block: PollBlock }) {
  const html = slideMarkdownToSafeHtml(block.prompt)
  const containerRef = useRef<HTMLDivElement>(null)
  const { me } = useAccount(PlaydeckAccount)
  useJazzImages(containerRef, me)

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center overflow-y-auto bg-primary",
        "min-h-[min(40vh,44%)] py-5 sm:min-h-[min(36vh,40%)] sm:py-6 md:py-7",
        "text-primary-foreground",
      )}
    >
      <div
        ref={containerRef}
        className={theaterPromptProseClass}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update the card/overlay prompt container**

Find the inline `dangerouslySetInnerHTML` at ~line 400 (inside the main `PollSlideCard` render). It's inside a `<div>` with `prose prose-invert` classes. We need to:
1. Add `const promptRef = useRef<HTMLDivElement>(null)` near other hooks in the component
2. Add `const { me } = useAccount(PlaydeckAccount)` near other hooks
3. Call `useJazzImages(promptRef, me)`
4. Attach `ref={promptRef}` to that div

Find the surrounding component (it's inside `PollSlideCard` or the overlay sub-render function). Look for the `prose prose-invert max-w-none prose-p:leading-relaxed` div. Add `ref={promptRef}` to it:

```tsx
// In PollSlideCard component, add near top hooks:
const promptRef = useRef<HTMLDivElement>(null)
const { me } = useAccount(PlaydeckAccount)
useJazzImages(promptRef, me)

// Find the prose div around line 400 and add ref:
<div
  ref={promptRef}
  className={cn(
    "prose prose-invert max-w-none prose-p:leading-relaxed",
    overlay && "prose-p:text-2xl prose-p:font-medium md:prose-p:text-3xl",
  )}
  dangerouslySetInnerHTML={{
    __html: slideMarkdownToSafeHtml(block.prompt),
  }}
/>
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/playdeck && pnpm typecheck 2>&1 | grep poll-slide-card
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/playdeck/features/slides/poll-slide-card.tsx
git commit -m "feat: apply useJazzImages to poll slide prompt containers"
```

---

## Task 10: Full test run and regression check

- [ ] **Step 1: Run all tests**

```bash
cd apps/playdeck && pnpm test
```

Expected: all existing tests pass + new tests pass. No regressions in `slide-markdown-document.test.ts`, `parse-slide-question.test.ts`, `parse-slide-poll.test.ts`, or `question-slide-card.test.tsx`.

- [ ] **Step 2: Manual regression — normal text paste**

1. In the deck editor, copy some text and paste with `Cmd+V`
2. Expected: text inserted normally, no interference from image paste extension

- [ ] **Step 3: Manual regression — external URL image**

In the editor, type:

```
![photo](https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png)
```

Expected: preview panel shows the external image. No `data-jazz-id` in rendered HTML.

- [ ] **Step 4: Manual regression — existing slides**

Open an existing deck with slides. Expected: slides load and display normally.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: address regression issues from image handling integration"
```

---

## Verification Checklist

Run through the spec verification matrix manually after Task 10:

| Scenario | Pass? |
|---|---|
| Paste image in editor → placeholder appears, replaced with image in preview | |
| Drop single image → inserted at correct line, renders in preview | |
| Drop multiple images → each inserts sequentially, all render | |
| `/image` command → file picker opens, image inserts at correct line | |
| Paste non-image file → no insertion, normal paste preserved | |
| Drop non-image file → no insertion, CM default drop preserved | |
| Upload fails → token removed, error shown in status bar | |
| External URL image → renders normally | |
| Presenter view → image visible in Reveal.js slide | |
| Follower view → image visible for student | |
| Poll prompt presenter → image renders in prompt | |
| Poll prompt follower → image renders in prompt | |
| Slow load → blur placeholder shown first | |
| Failed load → grey broken-image box, slide stable | |
| Memory → no blob URL leaks (check DevTools Memory tab) | |
