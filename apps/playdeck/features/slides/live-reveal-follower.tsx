"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@beyond/design-system"
import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import { RevealSlideBody } from "@/features/slides/deck-reveal-presenter"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

export type LiveRevealFollowerProps = {
  /** Keys the Reveal subtree so Strict Mode / destroy() get a fresh DOM per session. */
  sessionId: string
  deckTitle: string
  slides: RevealSlideModel[]
  activeSlideIndex: number
  status: "live" | "ended"
}

export function LiveRevealFollower({
  sessionId,
  deckTitle,
  slides,
  activeSlideIndex,
  status,
}: LiveRevealFollowerProps) {
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Must match Reveal's current slide for RevealSlideBody lazy window (not only Jazz index). */
  const [revealIndex, setRevealIndex] = useState(0)
  const revealRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const activeSlideIndexRef = useRef(activeSlideIndex)
  const numSlides = slides.length

  useEffect(() => {
    activeSlideIndexRef.current = activeSlideIndex
  }, [activeSlideIndex])

  useEffect(() => {
    if (!revealRef.current || numSlides < 1) {
      return
    }

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
      keyboard: false,
      touch: false,
      overview: false,
    })

    let cancelled = false
    deck
      .initialize()
      .then(() => {
        if (cancelled) {
          return
        }
        const h = Math.min(
          Math.max(0, activeSlideIndexRef.current),
          Math.max(0, numSlides - 1),
        )
        deck.slide(h, 0)
        const ih = deck.getIndices().h
        setRevealIndex(ih)
        deckApiRef.current = deck
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
        requestAnimationFrame(() => {
          if (cancelled) return
          deck.layout()
        })
      })
      .catch((err: unknown) => {
        console.error("Reveal.initialize() failed", err)
        setLoadError("Could not load the live session.")
      })

    return () => {
      cancelled = true
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      deck.destroy()
      deckApiRef.current = null
    }
  }, [numSlides, sessionId])

  useEffect(() => {
    const deck = deckApiRef.current
    if (!deck || numSlides < 1) return
    const h = Math.min(Math.max(0, activeSlideIndex), numSlides - 1)
    const cur = deck.getIndices?.().h
    if (cur === h) return
    deck.slide(h, 0)
    setRevealIndex(deck.getIndices().h)
    deck.layout()
  }, [activeSlideIndex, numSlides])

  useEffect(() => {
    deckApiRef.current?.layout()
  }, [slides.length])

  if (numSlides < 1) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
        No slides in this session.
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deckTitle}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Live · slide {Math.min(activeSlideIndex + 1, numSlides)} /{" "}
            {numSlides}
          </p>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {loadError ? (
          <p className="p-6 text-center text-sm text-destructive">{loadError}</p>
        ) : (
          <div
            key={sessionId}
            className="absolute inset-0 z-0 flex flex-col"
          >
            <div
              ref={viewportRef}
              className="reveal-viewport h-full min-h-0 w-full flex-1"
            >
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
                        activeIndex={revealIndex}
                      />
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {status === "ended" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center",
            "bg-background/80 backdrop-blur-sm",
          )}
        >
          <p className="rounded-md border border-border bg-card px-4 py-3 text-sm font-medium shadow-lg">
            This live session has ended.
          </p>
        </div>
      ) : null}
    </div>
  )
}
