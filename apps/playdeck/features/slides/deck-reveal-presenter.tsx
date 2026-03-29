"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import { Button, buttonVariants, cn } from "@beyond/design-system"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Minimize2,
} from "lucide-react"
import Link from "next/link"
import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

export type DeckRevealPresenterProps = {
  deckTitle: string
  slides: RevealSlideModel[]
  backHref: string
  initialSlideIndex?: number
}

const LAZY_RADIUS = 2

export function DeckRevealPresenter({
  deckTitle,
  slides,
  backHref,
  initialSlideIndex = 0,
}: DeckRevealPresenterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [view, setView] = useState<"slide" | "grid">("slide")
  const [activeIndex, setActiveIndex] = useState(initialSlideIndex)
  const [loadError, setLoadError] = useState<string | null>(null)

  const revealRef = useRef<HTMLDivElement>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const initialIndexRef = useRef(initialSlideIndex)
  const onSlideChangedHandlerRef = useRef<() => void>(() => {})

  const numSlides = slides.length

  const replaceSlideQuery = useCallback(
    (index: number) => {
      const next = new URLSearchParams()
      next.set("slide", String(index + 1))
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [pathname, router],
  )

  const onSlideChanged = useCallback(() => {
    const deck = deckApiRef.current
    const h = deck?.getIndices?.().h
    if (typeof h !== "number" || Number.isNaN(h)) return
    setActiveIndex(h)
    replaceSlideQuery(h)
  }, [replaceSlideQuery])

  useEffect(() => {
    onSlideChangedHandlerRef.current = onSlideChanged
  }, [onSlideChanged])

  useEffect(() => {
    if (view !== "slide" || !revealRef.current || numSlides < 1) return

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
        const start = Math.min(
          initialIndexRef.current,
          Math.max(0, numSlides - 1),
        )
        deck.slide(start, 0)
        deckApiRef.current = deck
        setActiveIndex(deck.getIndices().h)
        el.addEventListener("slidechanged", wrapped)
      })
      .catch(() => {
        setLoadError("Could not start presentation.")
      })

    return () => {
      cancelled = true
      el.removeEventListener("slidechanged", wrapped)
      deck.destroy()
      deckApiRef.current = null
    }
  }, [view, numSlides])

  useEffect(() => {
    if (view === "slide") {
      deckApiRef.current?.layout()
    }
  }, [view])

  const goPrev = useCallback(() => {
    deckApiRef.current?.prev()
  }, [])

  const goNext = useCallback(() => {
    deckApiRef.current?.next()
  }, [])

  const toggleGrid = useCallback(() => {
    setView((v) => (v === "slide" ? "grid" : "slide"))
  }, [])

  const onGridPickSlide = useCallback(
    (i: number) => {
      setActiveIndex(i)
      deckApiRef.current?.slide(i, 0)
      replaceSlideQuery(i)
      setView("slide")
    },
    [replaceSlideQuery],
  )

  if (numSlides < 1) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This deck has no slides yet. Add slides from the deck page.
        </p>
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deckTitle}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Slide {activeIndex + 1} / {numSlides}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous slide"
            disabled={view === "grid" || activeIndex <= 0}
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next slide"
            disabled={
              view === "grid" || activeIndex >= numSlides - 1
            }
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={view === "grid" ? "Slide view" : "Grid view"}
            aria-pressed={view === "grid"}
            onClick={toggleGrid}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "ml-2 inline-flex items-center gap-1.5",
            )}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Exit
          </Link>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {loadError ? (
          <p className="p-6 text-center text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            <div
              className={cn(
                "absolute inset-0 z-0 flex flex-col",
                view !== "slide" &&
                  "pointer-events-none invisible opacity-0",
              )}
              aria-hidden={view !== "slide"}
            >
              <div className="reveal-viewport h-full min-h-0 w-full flex-1">
                <div ref={revealRef} className="reveal h-full min-h-[50vh]">
                  <div className="slides">
                    {slides.map((slide, i) => (
                      <section
                        key={i}
                        className="flex items-center justify-center !p-4"
                        data-background-color="#0d1117"
                      >
                        <RevealSlideBody
                          html={slide.html}
                          slideIndex={i}
                          activeIndex={activeIndex}
                        />
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {view === "grid" ? (
              <div className="relative z-10 flex min-h-[50vh] flex-1 flex-col overflow-auto p-4">
                <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {slides.map((slide, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onGridPickSlide(i)}
                      className={cn(
                        "flex flex-col rounded-md border bg-card p-3 text-left text-sm transition-colors",
                        "hover:border-ring/60 hover:bg-muted/40",
                        i === activeIndex && "border-ring ring-1 ring-ring/30",
                      )}
                    >
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="mt-1 line-clamp-2 font-medium">
                        {slide.title.trim() || `Slide ${i + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function RevealSlideBody({
  html,
  slideIndex,
  activeIndex,
}: {
  html: string
  slideIndex: number
  activeIndex: number
}) {
  const show = Math.abs(slideIndex - activeIndex) <= LAZY_RADIUS

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
    html.trim() === ""
      ? '<p class="text-muted-foreground">Empty slide</p>'
      : html

  return (
    <div
      className="prose prose-invert max-h-[min(70vh,700px)] w-full max-w-4xl overflow-auto px-2 text-left prose-headings:font-semibold prose-p:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}
