"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import { RevealSlideBody } from "@/features/slides/deck-reveal-presenter"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"
import { Button, cn } from "@beyond/design-system"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

const SYNC_DEBOUNCE_MS = 80

export type DeckRevealPreviewProps = {
  slides: RevealSlideModel[]
  /** Stable serialized slide content for sync (e.g. JSON of html strings). */
  slidesContentKey: string
  className?: string
}

export function DeckRevealPreview({
  slides,
  slidesContentKey,
  className,
}: DeckRevealPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const revealRef = useRef<HTMLDivElement>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const onSlideChangedHandlerRef = useRef<() => void>(() => {})
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const numSlides = slides.length

  const onSlideChanged = useCallback(() => {
    const deck = deckApiRef.current
    const h = deck?.getIndices?.().h
    if (typeof h !== "number" || Number.isNaN(h)) return
    setActiveIndex(h)
  }, [])

  useEffect(() => {
    onSlideChangedHandlerRef.current = onSlideChanged
  }, [onSlideChanged])

  useEffect(() => {
    if (!revealRef.current || numSlides < 1) return

    const el = revealRef.current
    const deck = new Reveal(el, {
      embedded: true,
      hash: false,
      controls: false,
      progress: true,
      slideNumber: "c/t",
      transition: "slide",
      backgroundTransition: "fade",
      width: 960,
      height: 700,
      margin: 0.04,
    })

    const wrapped = () => onSlideChangedHandlerRef.current()

    let cancelled = false
    deck
      .initialize()
      .then(() => {
        if (cancelled) return
        deck.slide(0, 0)
        deckApiRef.current = deck
        setActiveIndex(deck.getIndices().h)
        el.addEventListener("slidechanged", wrapped)
      })
      .catch(() => {
        setLoadError("Could not start preview.")
      })

    return () => {
      cancelled = true
      el.removeEventListener("slidechanged", wrapped)
      deck.destroy()
      deckApiRef.current = null
    }
  }, [numSlides])

  useLayoutEffect(() => {
    if (numSlides < 1) return
    const deck = deckApiRef.current
    if (!deck) return
    if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null
      deck.sync()
      deck.layout()
    }, SYNC_DEBOUNCE_MS)
    return () => {
      if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current)
    }
  }, [slidesContentKey, numSlides])

  const goPrev = useCallback(() => {
    deckApiRef.current?.prev()
  }, [])

  const goNext = useCallback(() => {
    deckApiRef.current?.next()
  }, [])

  if (numSlides < 1) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] flex-1 items-center justify-center bg-muted/30 px-4 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Add Markdown on the left (split slides with a line containing only{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">---</code>
        ) to see the preview.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          Preview · Slide {activeIndex + 1} / {numSlides}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous slide"
            disabled={activeIndex <= 0}
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next slide"
            disabled={activeIndex >= numSlides - 1}
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {loadError ? (
          <p className="p-6 text-center text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            <div className="reveal-viewport h-full min-h-0 w-full">
              <div ref={revealRef} className="reveal h-full min-h-[50vh]">
                <div className="slides">
                  {slides.map((slide, i) => (
                    <section
                      key={i}
                      className="flex items-center justify-center !p-4"
                      data-background-color="#0d1117"
                    >
                      <RevealSlideBody
                        slide={slide}
                        slideIndex={i}
                        activeIndex={activeIndex}
                      />
                    </section>
                  ))}
                </div>
              </div>
            </div>

            {slides[activeIndex]?.interactiveError ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    <InteractiveErrorCard
                      layout="overlay"
                      title={slides[activeIndex].title}
                      message={slides[activeIndex].interactiveError!.message}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {slides[activeIndex]?.poll ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    <PollSlideCard
                      layout="overlay"
                      block={slides[activeIndex].poll!}
                      variant="preview"
                      counts={Array.from(
                        {
                          length: slides[activeIndex].poll!.options.length,
                        },
                        () => 0,
                      )}
                      myVote={null}
                      name={`preview-poll-${activeIndex}`}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {slides[activeIndex]?.question ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    <QuestionSlideCard
                      layout="overlay"
                      block={slides[activeIndex].question!}
                      variant="preview"
                      state="idle"
                      counts={Array.from(
                        {
                          length: slides[activeIndex].question!.options.length,
                        },
                        () => 0,
                      )}
                      answeredCount={0}
                      myAnswer={null}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
