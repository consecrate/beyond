"use client"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"
import { useMemo, useState, useTransition } from "react"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { replaceSlidesFromMarkdown } from "@/features/decks/jazz-deck-mutations"
import type { DeckSlideView } from "@/features/decks/deck-types"
import {
  deckSlidesToRevealModels,
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import { DeckMarkdownEditor } from "@/features/decks/components/deck-markdown-editor"
import { DeckRevealPreview } from "@/features/slides/deck-reveal-preview"
import { Button } from "@beyond/design-system"

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
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()

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
    () => JSON.stringify(revealModels.map((s) => s.html)),
    [revealModels],
  )

  const addSlide = () => {
    setMarkdown((m) => {
      const t = m.trim()
      if (t === "") return "# New slide\n\n"
      return `${m.replace(/\s+$/, "")}\n---\n\n# New slide\n\n`
    })
  }

  const save = () => {
    if (!me.$isLoaded) return
    assertLoaded(me.root)
    startTransition(() => {
      const r = replaceSlidesFromMarkdown(me, deckId, markdown)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError(undefined)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="shrink-0 border-b border-border px-3 py-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Markdown · slides separated by{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
                ---
              </code>{" "}
              on its own line
            </p>
          </div>
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
          <span className="text-sm text-muted-foreground" />
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addSlide}>
            Add slide
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save deck"}
          </Button>
        </div>
      </div>
    </div>
  )
}
