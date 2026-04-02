"use client"

/* eslint-disable react-hooks/refs -- reveal.js + Jazz account stability need ref patterns ESLint cannot prove safe */

import { useCallback, useEffect, useRef, useState, memo } from "react"
import { useAccount } from "jazz-tools/react"

import { importedSlideRevealBackgroundUrl } from "@/features/decks/parse-slide-import"
import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import {
  ImportedSlideFrame,
  useImportedSlidePrefetch,
} from "@/features/slides/imported-slide-frame"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"
import { CodeSlideCard } from "@/features/slides/code-slide-card"
import { useRevealAutoLayout } from "@/features/slides/use-reveal-auto-layout"
import { useJazzImages } from "@/features/slides/use-jazz-images"
import type { Loaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { Button, cn } from "@beyond/design-system"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import Reveal from "reveal.js"
import type { RevealApi, RevealConfig } from "reveal.js"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

const LAZY_RADIUS = 2

export type DeckRevealPreviewProps = {
  slides: RevealSlideModel[]
  /** Stable serialized slide content for sync (e.g. JSON of html strings). */
  slidesContentKey: string
  className?: string
}

/** Memoized slide body to prevent re-renders when other slides change */
const SlideBody = memo(function SlideBody({
  slide,
  slideIndex,
  activeIndex,
  me,
}: {
  slide: RevealSlideModel
  slideIndex: number
  activeIndex: number
  me: Loaded<typeof PlaydeckAccount> | null | undefined
}) {
  const show = Math.abs(slideIndex - activeIndex) <= LAZY_RADIUS
  const containerRef = useRef<HTMLDivElement>(null)

  // Each slide needs its own useJazzImages for the images to work correctly
  useJazzImages(containerRef, me, slide.html)

  if (slide.poll || slide.question || slide.interactiveError || slide.code) {
    return <div className="h-0 w-0 overflow-hidden opacity-0" aria-hidden />
  }

  if (!show) {
    if (
      slide.importedImage &&
      importedSlideRevealBackgroundUrl(slide.importedImage.src)
    ) {
      return (
        <div className="h-0 w-0 overflow-hidden opacity-0" aria-hidden />
      )
    }
    return (
      <div
        className="flex min-h-[min(70vh,700px)] w-full max-w-4xl items-center justify-center"
        aria-hidden
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (slide.importedImage) {
    const bgUrl = importedSlideRevealBackgroundUrl(slide.importedImage.src)
    if (bgUrl) {
      return (
        <div className="flex h-full w-full min-h-0 flex-col">
          <span className="sr-only">
            {slide.title.trim() || "Imported slide"}
          </span>
          <div className="min-h-0 flex-1" aria-hidden />
        </div>
      )
    }
    return (
      <ImportedSlideFrame
        source={slide.importedImage.src}
        title={slide.title}
        priority={slideIndex === activeIndex}
        className="h-full w-full max-w-full"
      />
    )
  }

  const inner =
    slide.html.trim() === ""
      ? '<p class="text-muted-foreground">Empty slide</p>'
      : slide.html

  return (
    <div
      ref={containerRef}
      className="slide-markdown-prose prose prose-invert w-full max-w-4xl px-2 text-left prose-headings:font-semibold prose-p:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
})

export function DeckRevealPreview({
  slides,
  slidesContentKey,
  className,
}: DeckRevealPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revealReady, setRevealReady] = useState(false)

  const revealRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const onSlideChangedHandlerRef = useRef<() => void>(() => {})
  const activeIndexRef = useRef(0)

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
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const requestRevealLayout = useCallback(() => {
    const deck = deckApiRef.current
    if (!deck) return
    deck.sync()
    deck.layout()
  }, [])

  useRevealAutoLayout({
    enabled: revealReady && numSlides > 0,
    contentRef: revealRef,
    viewportRef,
    onLayout: requestRevealLayout,
  })

  useImportedSlidePrefetch(slides, activeIndex, revealReady)

  useEffect(() => {
    if (!revealRef.current || numSlides < 1) return

    const el = revealRef.current
    const revealOptions: RevealConfig = {
      embedded: true,
      hash: false,
      controls: false,
      progress: true,
      slideNumber: "c/t",
      transition: "slide",
      backgroundTransition: "fade",
      width: 960,
      height: 700,
      margin: 0,
    }
    const deck = new Reveal(el, revealOptions)

    const wrapped = () => onSlideChangedHandlerRef.current()

    let cancelled = false
    deck
      .initialize()
      .then(() => {
        if (cancelled) return
        const start = Math.min(
          Math.max(0, activeIndexRef.current),
          Math.max(0, numSlides - 1),
        )
        deck.slide(start, 0)
        deckApiRef.current = deck
        setActiveIndex(deck.getIndices().h)
        setRevealReady(true)
        deck.layout()
        const viewportEl = viewportRef.current
        if (viewportEl && typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current?.disconnect()
          const ro = new ResizeObserver(() => {
            deckApiRef.current?.layout()
          })
          ro.observe(viewportEl)
          resizeObserverRef.current = ro
        }
        el.addEventListener("slidechanged", wrapped)
      })
      .catch(() => {
        setLoadError("Could not start preview.")
      })

    return () => {
      cancelled = true
      setRevealReady(false)
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      el.removeEventListener("slidechanged", wrapped)
      deck.destroy()
      deckApiRef.current = null
    }
  }, [slidesContentKey, numSlides])

  // Single useAccount but memoize to prevent re-renders
  const me = useAccount(PlaydeckAccount, {
    select: (account) => (account.$isLoaded ? account : null),
  })
  const stableMeRef = useRef(me)
  if (me !== stableMeRef.current) {
    stableMeRef.current = me
  }

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
            <div ref={viewportRef} className="reveal-viewport h-full min-h-0 w-full">
              <div ref={revealRef} className="reveal h-full min-h-[50vh]">
                <div className="slides">
                  {slides.map((slide, i) => {
                    const importedBgUrl =
                      slide.importedImage &&
                      importedSlideRevealBackgroundUrl(
                        slide.importedImage.src,
                      )
                    return (
                      <section
                        key={i}
                        className={cn(
                          "flex items-center justify-center",
                          slide.importedImage ? "!p-0" : "!p-4",
                        )}
                        data-background-color="#0d1117"
                        {...(importedBgUrl
                          ? {
                              "data-background-image": importedBgUrl,
                              "data-background-size": "cover",
                              "data-background-position": "center",
                              "data-background-repeat": "no-repeat",
                            }
                          : {})}
                      >
                        <SlideBody
                          slide={slide}
                          slideIndex={i}
                          activeIndex={activeIndex}
                          me={stableMeRef.current}
                        />
                      </section>
                    )
                  })}
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

            {slides[activeIndex]?.code ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
                    <CodeSlideCard
                      block={slides[activeIndex].code!}
                      layout="overlay"
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
