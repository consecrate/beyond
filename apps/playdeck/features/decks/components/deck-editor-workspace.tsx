"use client"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { replaceSlidesFromMarkdown } from "@/features/decks/jazz-deck-mutations"
import type { DeckSlideView } from "@/features/decks/deck-types"
import { appendPollSlideMarkdown } from "@/features/decks/parse-slide-poll"
import {
  deckSlidesToRevealModels,
  markdownMatchesSlides,
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import { DeckMarkdownEditor } from "@/features/decks/components/deck-markdown-editor"
import { DeckRevealPreview } from "@/features/slides/deck-reveal-preview"
import { Button } from "@beyond/design-system"

const AUTOSAVE_MS = 600

function initialMarkdown(slides: DeckSlideView[]): string {
  if (slides.length === 0) return "# Slide\n\n"
  return slidesToMarkdownDocument(slides)
}

type Props = {
  deckId: string
  slides: DeckSlideView[]
}

export function DeckEditorWorkspace({ deckId, slides }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: { root: { decks: { $each: { slides: { $each: true } } } } },
  })
  const [markdown, setMarkdown] = useState(() => initialMarkdown(slides))
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState(() =>
    initialMarkdown(slides),
  )
  const [error, setError] = useState<string | undefined>()
  const [pending, startSaveTransition] = useTransition()

  const markdownRef = useRef(markdown)
  const lastSavedRef = useRef(lastSavedMarkdown)

  useEffect(() => {
    markdownRef.current = markdown
    lastSavedRef.current = lastSavedMarkdown
  }, [markdown, lastSavedMarkdown])

  const slidesSyncKey = useMemo(
    () =>
      slides
        .map((s) => `${s.id}\t${s.updated_at}\t${s.title}\t${s.body}`)
        .join("\n"),
    [slides],
  )

  useEffect(() => {
    if (markdown !== lastSavedMarkdown) return
    const next = initialMarkdown(slides)
    if (next === markdown) return
    if (markdownMatchesSlides(markdown, slides)) return
    startTransition(() => {
      setMarkdown(next)
      setLastSavedMarkdown(next)
      lastSavedRef.current = next
    })
  }, [slidesSyncKey, slides, markdown, lastSavedMarkdown])

  useEffect(() => {
    if (markdownRef.current === lastSavedRef.current) return
    const t = setTimeout(() => {
      const current = markdownRef.current
      if (current === lastSavedRef.current) return
      if (!me.$isLoaded) return
      assertLoaded(me.root)
      startSaveTransition(() => {
        const r = replaceSlidesFromMarkdown(me, deckId, current)
        if (!r.ok) {
          setError(r.error)
          return
        }
        setError(undefined)
        lastSavedRef.current = current
        setLastSavedMarkdown(current)
      })
    }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [markdown, deckId, me])

  useEffect(() => {
    return () => {
      const current = markdownRef.current
      if (current === lastSavedRef.current) return
      if (!me.$isLoaded) return
      assertLoaded(me.root)
      replaceSlidesFromMarkdown(me, deckId, current)
    }
  }, [deckId, me])

  const parsed = useMemo(
    () => parseMarkdownDocumentToSlides(markdown),
    [markdown],
  )
  const nonEmptyParsed = useMemo(
    () =>
      parsed.filter(
        (s) => s.title.trim() !== "" || s.body.trim() !== "",
      ),
    [parsed],
  )
  const revealModels = useMemo(
    () => deckSlidesToRevealModels(nonEmptyParsed),
    [nonEmptyParsed],
  )
  const slidesContentKey = useMemo(
    () =>
      JSON.stringify(
        revealModels.map((s) => [s.html, s.poll?.pollKey ?? null]),
      ),
    [revealModels],
  )

  const isDirty = markdown !== lastSavedMarkdown

  const addSlide = () => {
    setMarkdown((m) => {
      const t = m.trim()
      if (t === "") return "# New slide\n\n"
      return `${m.replace(/\s+$/, "")}\n---\n\n# New slide\n\n`
    })
  }

  const statusMessage = error
    ? null
    : pending
      ? "Saving…"
      : isDirty
        ? "Unsaved changes"
        : "Saved"

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="min-h-0 min-w-0 flex-1">
            <DeckMarkdownEditor
              className="h-full min-h-[200px]"
              value={markdown}
              onChange={setMarkdown}
            />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DeckRevealPreview
            slides={revealModels}
            slidesContentKey={slidesContentKey}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMarkdown((m) => appendPollSlideMarkdown(m))}
          >
            Add poll slide
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addSlide}>
            Add slide
          </Button>
        </div>
      </div>
    </div>
  )
}
