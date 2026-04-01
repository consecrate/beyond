"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import type { Loaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import {
  aggregatePollCounts,
  aggregateQuestionCounts,
  countQuestionAnswers,
  isPollClosed,
  questionStatus,
} from "@/features/jazz/live-session-mutations"
import type { LiveSession } from "@/features/jazz/schema"
import { PlaydeckAccount } from "@/features/jazz/schema"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"
import { useJazzImages } from "@/features/slides/use-jazz-images"
import { Button, buttonVariants, cn } from "@beyond/design-system"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Minimize2,
  Radio,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"
import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

export type DeckLiveControls = {
  isActive: boolean
  joinCode: string | null
  onGoLive: (currentSlideIndex: number) => void | Promise<void>
  onEndLive: () => void | Promise<void>
  onSlideIndexSync?: (index: number) => void
  /** When live, poll slides show tallies from this CoValue. */
  liveSession?: Loaded<typeof LiveSession> | null
  onSetLobbyVisible?: (visible: boolean) => void | Promise<void>
  onKickPlayer?: (accountId: string) => void | Promise<void>
  onClosePoll?: (pollKey: string) => void | Promise<void>
  onStartQuestion?: (questionKey: string) => void | Promise<void>
  onStopQuestion?: (questionKey: string, correctOptionIndex?: number) => void | Promise<void>
}

export type DeckRevealPresenterProps = {
  deckTitle: string
  slides: RevealSlideModel[]
  backHref: string
  initialSlideIndex?: number
  live?: DeckLiveControls
}

const LAZY_RADIUS = 2

const REVEAL_WIDTH = 960
const REVEAL_HEIGHT = 700

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
  const me = useAccount(PlaydeckAccount, {
    select: (account) => (account.$isLoaded ? account : null),
  })

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

function GridSlideThumbnail({
  slide,
  index,
  live,
}: {
  slide: RevealSlideModel
  index: number
  live?: DeckLiveControls
}) {
  if (slide.interactiveError) {
    return (
      <div
        className="@container relative w-full overflow-hidden rounded-md border border-border bg-background"
        style={{ aspectRatio: `${REVEAL_WIDTH} / ${REVEAL_HEIGHT}` }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: REVEAL_WIDTH,
            height: REVEAL_HEIGHT,
            transform: `scale(calc(100cqw / ${REVEAL_WIDTH}px))`,
          }}
        >
          <div className="h-full w-full overflow-hidden p-2">
            <InteractiveErrorCard
              layout="card"
              title={slide.title}
              message={slide.interactiveError.message}
            />
          </div>
        </div>
      </div>
    )
  }

  if (slide.question) {
    const liveSession =
      live?.isActive && live.liveSession ? live.liveSession : null
    const status = liveSession
      ? questionStatus(liveSession, slide.question.questionKey)
      : "idle"
    const answeredCount = liveSession
      ? countQuestionAnswers(liveSession, slide.question.questionKey)
      : 0
    const counts =
      liveSession && status === "revealed"
        ? aggregateQuestionCounts(
          liveSession,
          slide.question.questionKey,
          slide.question.options.length,
        )
        : Array.from({ length: slide.question.options.length }, () => 0)

    return (
      <div
        className="@container relative w-full overflow-hidden rounded-md border border-border bg-background"
        style={{ aspectRatio: `${REVEAL_WIDTH} / ${REVEAL_HEIGHT}` }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: REVEAL_WIDTH,
            height: REVEAL_HEIGHT,
            transform: `scale(calc(100cqw / ${REVEAL_WIDTH}px))`,
          }}
        >
          <div className="h-full w-full overflow-hidden p-2">
            <QuestionSlideCard
              layout="card"
              block={slide.question}
              variant={liveSession ? "presenter" : "preview"}
              state={status}
              counts={counts}
              answeredCount={answeredCount}
              myAnswer={null}
            />
          </div>
        </div>
      </div>
    )
  }

  const poll = slide.poll
  if (poll) {
    const liveSession =
      live?.isActive && live.liveSession ? live.liveSession : null
    const counts = liveSession
      ? aggregatePollCounts(liveSession, poll.pollKey, poll.options.length)
      : Array.from({ length: poll.options.length }, () => 0)
    const pollClosed = liveSession
      ? isPollClosed(liveSession, poll.pollKey)
      : false
    return (
      <div
        className="@container relative w-full overflow-hidden rounded-md border border-border bg-background"
        style={{ aspectRatio: `${REVEAL_WIDTH} / ${REVEAL_HEIGHT}` }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: REVEAL_WIDTH,
            height: REVEAL_HEIGHT,
            transform: `scale(calc(100cqw / ${REVEAL_WIDTH}px))`,
          }}
        >
          <div className="h-full w-full overflow-hidden p-2">
            <PollSlideCard
              layout="card"
              block={poll}
              variant={liveSession ? "presenter" : "preview"}
              counts={counts}
              myVote={null}
              name={`grid-poll-${index}`}
              pollClosed={pollClosed}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="@container relative w-full overflow-hidden rounded-md border border-border bg-[#0d1117]"
      style={{ aspectRatio: `${REVEAL_WIDTH} / ${REVEAL_HEIGHT}` }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{
          width: REVEAL_WIDTH,
          height: REVEAL_HEIGHT,
          transform: `scale(calc(100cqw / ${REVEAL_WIDTH}px))`,
        }}
      >
        <RevealSlideBody
          slide={{ ...slide, poll: null, question: null, interactiveError: null }}
          slideIndex={index}
          activeIndex={index}
        />
      </div>
    </div>
  )
}

export function DeckRevealPresenter({
  deckTitle,
  slides,
  backHref,
  initialSlideIndex = 0,
  live,
}: DeckRevealPresenterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [view, setView] = useState<"slide" | "grid">("slide")
  const [activeIndex, setActiveIndex] = useState(initialSlideIndex)
  const [loadError, setLoadError] = useState<string | null>(null)

  const revealRef = useRef<HTMLDivElement>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const initialIndexRef = useRef(initialSlideIndex)
  const onSlideChangedHandlerRef = useRef<() => void>(() => { })
  const liveSlideSyncRef = useRef<((index: number) => void) | undefined>(
    undefined,
  )

  const numSlides = slides.length

  useEffect(() => {
    liveSlideSyncRef.current =
      live?.isActive && live.onSlideIndexSync ? live.onSlideIndexSync : undefined
  }, [live?.isActive, live?.onSlideIndexSync])

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
    liveSlideSyncRef.current?.(h)
  }, [replaceSlideQuery])

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
  }, [numSlides])

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
      liveSlideSyncRef.current?.(i)
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
          {live ? (
            <>
              {!live.isActive ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ml-1"
                  onClick={() => void live.onGoLive(activeIndex)}
                >
                  <Radio className="mr-1.5 h-3.5 w-3.5" />
                  Go Live
                </Button>
              ) : (
                <>
                  <span
                    className="max-w-[9rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs tabular-nums sm:max-w-[10rem]"
                    title="Share this code with viewers"
                  >
                    {live.joinCode ?? "—"}
                  </span>
                  <Button
                    type="button"
                    variant={live.liveSession?.is_lobby_visible ? "default" : "secondary"}
                    size="sm"
                    className="ml-1"
                    onClick={() => void live.onSetLobbyVisible?.(!live.liveSession?.is_lobby_visible)}
                  >
                    <Users className="mr-1.5 h-3.5 w-3.5" />
                    Lobby
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-1"
                    onClick={() => void live.onEndLive()}
                  >
                    End Live
                  </Button>
                </>
              )}
            </>
          ) : null}
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
                          slide={slide}
                          slideIndex={i}
                          activeIndex={activeIndex}
                        />
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {view === "slide" && slides[activeIndex]?.interactiveError ? (
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

            {view === "slide" && slides[activeIndex]?.poll ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    {live?.isActive && live.liveSession ? (
                      <PollSlideCard
                        layout="overlay"
                        block={slides[activeIndex].poll!}
                        variant="presenter"
                        counts={aggregatePollCounts(
                          live.liveSession,
                          slides[activeIndex].poll!.pollKey,
                          slides[activeIndex].poll!.options.length,
                        )}
                        myVote={null}
                        name={`present-poll-${activeIndex}`}
                        pollClosed={isPollClosed(
                          live.liveSession,
                          slides[activeIndex].poll!.pollKey,
                        )}
                        onClosePoll={
                          live.onClosePoll
                            ? () => {
                              const close = live.onClosePoll
                              if (close) {
                                close(slides[activeIndex].poll!.pollKey)
                              }
                            }
                            : undefined
                        }
                      />
                    ) : (
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
                        name={`present-poll-${activeIndex}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {view === "slide" && slides[activeIndex]?.question ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    {live?.isActive && live.liveSession ? (
                      (() => {
                        const question = slides[activeIndex].question!
                        const state = questionStatus(
                          live.liveSession,
                          question.questionKey,
                        )
                        const resultsVisible =
                          state === "revealed" && live.liveSession.status === "ended"
                        const counts = resultsVisible
                          ? aggregateQuestionCounts(
                            live.liveSession,
                            question.questionKey,
                            question.options.length,
                          )
                          : Array.from({ length: question.options.length }, () => 0)

                        return (
                          <QuestionSlideCard
                            layout="overlay"
                            block={question}
                            variant="presenter"
                            state={state}
                            resultsVisible={resultsVisible}
                            counts={counts}
                            answeredCount={countQuestionAnswers(
                              live.liveSession,
                              question.questionKey,
                            )}
                            myAnswer={null}
                            onStart={
                              live.onStartQuestion
                                ? () => void live.onStartQuestion?.(question.questionKey)
                                : undefined
                            }
                            onStop={
                              live.onStopQuestion
                                ? () => void live.onStopQuestion?.(question.questionKey, question.correctOptionIndex)
                                : undefined
                            }
                          />
                        )
                      })()
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {live?.isActive && live.liveSession?.is_lobby_visible ? (
              <div className="absolute inset-0 z-50 flex flex-col bg-background">
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6 md:p-12">
                  <div className="mb-12 text-center">
                    <p className="mb-2 text-2xl font-medium tracking-tight text-muted-foreground sm:text-3xl">Go to <span className="text-foreground">playdeck.app</span> and enter code</p>
                    <h1 className="text-8xl font-black tracking-tighter text-primary sm:text-[10rem]">{live.joinCode || "—"}</h1>
                  </div>

                  {(() => {
                    const players = live.liveSession.joined_players && live.liveSession.joined_players.$isLoaded
                      ? Array.from(live.liveSession.joined_players)
                      : []
                    return (
                      <div className="w-full max-w-4xl">
                        <div className="mb-6 flex items-center justify-between">
                          <h2 className="text-xl font-semibold opacity-90">Players Joined</h2>
                          <span className="rounded-full bg-primary/20 px-3 py-1 font-mono text-sm font-bold text-primary">
                            {players.length}
                          </span>
                        </div>

                        {players.length === 0 ? (
                          <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-muted bg-muted/10">
                            <p className="animate-pulse text-muted-foreground">Waiting for players to join...</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {players.map((p, i: number) => {
                              if (!p || !p.$isLoaded) return null
                              return (
                                <div
                                  key={i}
                                  className="group relative flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-all hover:pr-10"
                                >
                                  <span>{p.name}</span>
                                  <button
                                    onClick={() => void live.onKickPlayer?.(p.account_id)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-muted p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-white group-hover:opacity-100"
                                    title="Kick Player"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                </div>
              </div>
            ) : null}

            {view === "grid" ? (
              <div className="relative z-10 flex min-h-[50vh] flex-1 flex-col overflow-auto p-4">
                <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {slides.map((slide, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to slide ${i + 1}`}
                      onClick={() => onGridPickSlide(i)}
                      className={cn(
                        "flex flex-col gap-2 rounded-md border bg-card p-2 text-left text-sm transition-colors",
                        "hover:border-ring/60 hover:bg-muted/40",
                        i === activeIndex && "border-ring ring-1 ring-ring/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 px-0.5">
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="line-clamp-1 min-w-0 text-xs font-medium">
                          {slide.title.trim() || `Slide ${i + 1}`}
                        </span>
                      </div>
                      <GridSlideThumbnail slide={slide} index={i} live={live} />
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
