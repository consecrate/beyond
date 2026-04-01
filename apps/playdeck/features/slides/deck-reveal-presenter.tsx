"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import type { Loaded } from "jazz-tools"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import {
  aggregatePollCounts,
  aggregateQuestionCounts,
  countQuestionAnswers,
  isPollClosed,
  questionStatus,
} from "@/features/jazz/live-session-mutations"
import type { LiveSession, SessionPlayer } from "@/features/jazz/schema"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"
import { BattleLog } from "@/features/slides/battle-log"
import { BattlePodium } from "@/features/slides/battle-podium"
import { BattleRoyaleArena } from "@/features/slides/battle-royale-arena"
import { Button, buttonVariants, cn } from "@beyond/design-system"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Minimize2,
  Radio,
  Star,
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
  onStartTeamFormation?: (numTeams: number) => void | Promise<void>
  onAssignTeamLeader?: (teamId: string, accountId: string | undefined) => void | Promise<void>
  onOpenTeamJoining?: () => void | Promise<void>
  onAutoAssignTeams?: () => void | Promise<void>
  onStartGameStore?: () => void | Promise<void>
  onStartGameplay?: () => void | Promise<void>
  /** Reset battle targets / phase before advancing to the next question slide (presenter only). */
  onResetBattleRound?: () => void | Promise<void>
  /** After revealed results, move everyone to the shared Battle Log screen (presenter only). */
  onShowBattleLog?: () => void | Promise<void>
  /** After battle log on the final battle question, show the Podium (presenter only). */
  onShowPodium?: () => void | Promise<void>
  /** Leave battle royale after Podium and return to normal slides (presenter only). */
  onLeaveBattleRoyaleAfterPodium?: () => void | Promise<void>
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

const BATTLE_ROYALE_TITLE_LC = "battle royale"

/** First question slide after `# Battle Royale`, else first slide with a question in the deck. */
export function findFirstBattleQuestionSlideIndex(
  slides: RevealSlideModel[],
): number | null {
  const n = slides.length
  if (n < 1) return null

  let battleRoyaleIdx = -1
  for (let i = 0; i < n; i++) {
    if (slides[i]?.title?.trim().toLowerCase() === BATTLE_ROYALE_TITLE_LC) {
      battleRoyaleIdx = i
      break
    }
  }

  if (battleRoyaleIdx >= 0) {
    for (let j = battleRoyaleIdx + 1; j < n; j++) {
      if (slides[j]?.question) return j
    }
  }

  for (let k = 0; k < n; k++) {
    if (slides[k]?.question) return k
  }

  return null
}

/** Last question slide in the Battle Royale section (after `# Battle Royale`), else last question in deck. */
export function findLastBattleQuestionSlideIndex(
  slides: RevealSlideModel[],
): number | null {
  const n = slides.length
  if (n < 1) return null

  let battleRoyaleIdx = -1
  for (let i = 0; i < n; i++) {
    if (slides[i]?.title?.trim().toLowerCase() === BATTLE_ROYALE_TITLE_LC) {
      battleRoyaleIdx = i
      break
    }
  }

  let lastQuestionIdx = -1
  if (battleRoyaleIdx >= 0) {
    for (let j = battleRoyaleIdx + 1; j < n; j++) {
      if (slides[j]?.question) lastQuestionIdx = j
    }
    if (lastQuestionIdx >= 0) return lastQuestionIdx
  }

  for (let k = n - 1; k >= 0; k--) {
    if (slides[k]?.question) return k
  }

  return null
}

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

    if (live?.isActive && live.liveSession && live.onSetLobbyVisible) {
      const slideTitle = slides[h]?.title?.trim()?.toLowerCase() || ""
      if (slideTitle === "battle royale") {
        live.onSetLobbyVisible(true)
        // Ensure game phase is set to lobby so we can do team formation again if needed, or just let them go to store.
        if (live.liveSession.game_phase === "playing" || !live.liveSession.game_phase) {
          // It's probably better to add a formal mutation for this, but for now we rely on the host's Lobby controls.
        }
      }
    }
  }, [replaceSlideQuery, slides, live])

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

  const goToSlide = useCallback(
    (i: number) => {
      const max = Math.max(0, numSlides - 1)
      const clamped = Math.min(Math.max(0, i), max)
      setActiveIndex(clamped)
      deckApiRef.current?.slide(clamped, 0)
      replaceSlideQuery(clamped)
      liveSlideSyncRef.current?.(clamped)
    },
    [numSlides, replaceSlideQuery],
  )

  const onGridPickSlide = useCallback(
    (i: number) => {
      goToSlide(i)
      setView("slide")
    },
    [goToSlide],
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
                  {live.liveSession?.game_phase === "lobby" && (
                    <span
                      className="max-w-[9rem] truncate rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs tabular-nums sm:max-w-[10rem]"
                      title="Share this code with viewers"
                    >
                      {live.joinCode ?? "—"}
                    </span>
                  )}
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
                        const resultsVisible = state === "revealed"
                        const counts = resultsVisible
                          ? aggregateQuestionCounts(
                            live.liveSession,
                            question.questionKey,
                            question.options.length,
                          )
                          : Array.from({ length: question.options.length }, () => 0)

                        const isBattleRoyale =
                          live.liveSession.game_phase === "battle_royale"
                        let activeBattlePhase:
                          | "target_selection"
                          | "question_active"
                          | "results"
                          | "battle_log"
                          | "podium"
                          | undefined
                        if (isBattleRoyale) {
                          const battleState = live.liveSession.battle_state
                          if (!battleState || !battleState.$isLoaded) {
                            return (
                              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Loading battle state…
                                </p>
                              </div>
                            )
                          }
                          const battlePhase =
                            battleState.phase ?? "target_selection"
                          activeBattlePhase = battlePhase
                          if (battlePhase === "target_selection") {
                            return (
                              <BattleRoyaleArena
                                liveSession={live.liveSession}
                                onStartQuestion={
                                  live.onStartQuestion
                                    ? () =>
                                        void live.onStartQuestion?.(
                                          question.questionKey,
                                        )
                                    : () => {}
                                }
                              />
                            )
                          }

                          if (battlePhase === "battle_log") {
                            return (
                              <BattleLog
                                liveSession={live.liveSession}
                                variant="presenter"
                                onNextQuestion={
                                  live.onResetBattleRound
                                    ? () => {
                                        const lastBattle =
                                          findLastBattleQuestionSlideIndex(slides)
                                        if (
                                          live.onShowPodium &&
                                          lastBattle !== null &&
                                          activeIndex === lastBattle
                                        ) {
                                          void live.onShowPodium()
                                        } else {
                                          void live.onResetBattleRound?.()
                                          goNext()
                                        }
                                      }
                                    : undefined
                                }
                              />
                            )
                          }

                          if (battlePhase === "podium") {
                            return (
                              <BattlePodium
                                liveSession={live.liveSession}
                                variant="presenter"
                                onContinue={
                                  live.onLeaveBattleRoyaleAfterPodium
                                    ? () => {
                                        void live.onLeaveBattleRoyaleAfterPodium?.()
                                        goNext()
                                      }
                                    : undefined
                                }
                              />
                            )
                          }
                        }

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
                                ? () =>
                                    void live.onStartQuestion?.(
                                      question.questionKey,
                                    )
                                : undefined
                            }
                            onStop={
                              live.onStopQuestion
                                ? () =>
                                    void live.onStopQuestion?.(
                                      question.questionKey,
                                      question.correctOptionIndex,
                                    )
                                : undefined
                            }
                            onPresenterNextQuestion={
                              isBattleRoyale &&
                              resultsVisible &&
                              activeBattlePhase === "results" &&
                              live.onShowBattleLog
                                ? () => void live.onShowBattleLog?.()
                                : undefined
                            }
                            presenterNextQuestionLabel={
                              isBattleRoyale ? "Show Battle Log" : "Next question"
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
                <div className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-auto p-6 pt-12 md:p-12 md:pt-20">
                  {(() => {
                    const gamePhase = live.liveSession?.game_phase ?? "lobby"
                    const formationState = live.liveSession?.team_formation_state ?? "idle"
                    
                    if (gamePhase !== "lobby" || formationState !== "idle") return null

                    return (
                      <div className="mb-8 text-center shrink-0">
                        <p className="mb-2 text-2xl font-medium tracking-tight text-muted-foreground sm:text-3xl">Go to <span className="text-foreground">play.joshing.us</span> and enter code</p>
                        <h1 className="text-8xl font-black tracking-tighter text-primary sm:text-[10rem] leading-none">{live.joinCode || "—"}</h1>
                      </div>
                    )
                  })()}

                  {(() => {
                    const players = live.liveSession.joined_players && live.liveSession.joined_players.$isLoaded
                      ? Array.from(live.liveSession.joined_players)
                      : []

                    const formationState = live.liveSession?.team_formation_state ?? "idle"
                    const gamePhase = live.liveSession?.game_phase ?? "lobby"
                    
                    if (gamePhase === "store") {
                       const teams = live.liveSession.teams && live.liveSession.teams.$isLoaded 
                          ? Array.from(live.liveSession.teams).filter(Boolean)
                          : []
                          
                       return (
                          <div className="w-full max-w-6xl animate-in fade-in zoom-in-95 duration-500">
                             <div className="mb-8 flex flex-col items-center gap-4 text-center">
                                <h2 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">Powerup Store</h2>
                                <p className="text-xl font-medium text-muted-foreground">Team Leaders are purchasing supplies for their teams...</p>
                             </div>
                             
                             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {teams.map(t => {
                                   if (!t || !t.$isLoaded) return null
                                   const teamPowerups = t.powerups && t.powerups.$isLoaded ? Array.from(t.powerups).filter(Boolean) : []
                                   return (
                                      <div key={t.id} className={cn("rounded-2xl border-2 p-6 flex flex-col gap-5 shadow-lg bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02]", t.color)}>
                                          <div className="flex items-center justify-between">
                                             <h3 className="text-2xl font-bold">{t.name}</h3>
                                             <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-sm font-bold text-red-500">
                                                   ❤️ {t.hp ?? 10}
                                                </div>
                                                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-500">
                                                   <Star className="h-4 w-4 fill-amber-500" />
                                                   {t.banked_play_points ?? 0}
                                                </div>
                                             </div>
                                          </div>
                                          
                                          <div className="flex-1 bg-background/60 rounded-xl p-4 min-h-[120px]">
                                             <p className="text-xs font-semibold mb-3 opacity-70 uppercase tracking-wider text-[var(--tw-prose-body)]">Acquired Items</p>
                                             {teamPowerups.length === 0 ? (
                                                <p className="text-sm italic opacity-50 text-[var(--tw-prose-body)] flex items-center justify-center h-full">Waiting for leader...</p>
                                             ) : (
                                                <div className="flex flex-wrap gap-2">
                                                   {teamPowerups.map((pu, i) => {
                                                      if (!pu || !pu.$isLoaded) return null
                                                      const puName = pu.type.replace("_", " ")
                                                      const member = players.find(p => p && p.$isLoaded && p.account_id === pu.owner_account_id) as Loaded<typeof SessionPlayer> | undefined
                                                      return (
                                                         <div key={i} className="flex items-center gap-1.5 rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm">
                                                            <span className="capitalize">{puName}</span>
                                                            <span className="opacity-50 mx-1">→</span>
                                                            <Users className="h-3 w-3 opacity-70" />
                                                            <span className="max-w-[80px] truncate">{member ? member.name : "Member"}</span>
                                                         </div>
                                                      )
                                                   })}
                                                </div>
                                             )}
                                          </div>
                                      </div>
                                   )
                                })}
                             </div>
                             
                             <div className="mt-16 flex justify-center">
                                <Button 
                                  size="lg" 
                                  className="h-16 rounded-full px-12 text-2xl font-black uppercase tracking-wider shadow-[0_0_30px_-5px_hsl(var(--primary))] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_50px_-5px_hsl(var(--primary))] bg-primary text-primary-foreground"
                                  onClick={() => {
                                     void live.onSetLobbyVisible?.(false)
                                     void live.onStartGameplay?.()
                                     const target = findFirstBattleQuestionSlideIndex(slides)
                                     if (target !== null) goToSlide(target)
                                  }}
                                >
                                  Begin Battle
                                </Button>
                             </div>
                          </div>
                       )
                    }

                    if (formationState === "idle") {
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

                          {players.length > 0 && (
                             <div className="mt-12 flex justify-center">
                               <Button size="lg" onClick={() => void live.onStartTeamFormation?.(2)}>
                                 Divide into Teams
                               </Button>
                             </div>
                          )}
                        </div>
                      )
                    }

                    const teams = live.liveSession.teams && live.liveSession.teams.$isLoaded 
                       ? Array.from(live.liveSession.teams).filter(Boolean)
                       : []
                    
                    const unassignedPlayers = players.filter((p): p is Loaded<typeof SessionPlayer> => !!p && p.$isLoaded && !p.team_id)
                    const assignedCount = players.length - unassignedPlayers.length

                    return (
                        <div className="w-full max-w-5xl">
                           <div className="mb-8 flex flex-col gap-6">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                 <h2 className="text-2xl font-bold">Team Builder</h2>
                                 {formationState === "setup" && (
                                    <div className="flex gap-2">
                                       {[2, 4, 6].map(num => (
                                          <Button 
                                             key={num} 
                                             variant={teams.length === num ? "default" : "outline"}
                                             size="sm"
                                             onClick={() => void live.onStartTeamFormation?.(num)}
                                           >
                                             {num} Teams
                                           </Button>
                                       ))}
                                    </div>
                                 )}
                               </div>
                               <div className="flex items-center gap-3">
                                 {formationState === "setup" && (
                                    <Button size="lg" variant="secondary" onClick={() => void live.onOpenTeamJoining?.()}>
                                      Lock & Open for Joining
                                    </Button>
                                 )}
                                 <div className="group relative inline-flex">
                                   {assignedCount === 0 && (
                                     <div className="absolute inset-0 z-10" />
                                   )}
                                   <Button 
                                     size="lg" 
                                     disabled={assignedCount === 0}
                                     onClick={() => void live.onStartGameStore?.()}
                                   >
                                     Start Game
                                   </Button>
                                   {assignedCount === 0 && (
                                     <div className="pointer-events-none absolute -top-12 left-1/2 -z-0 -translate-x-1/2 whitespace-nowrap rounded-lg bg-popover px-4 py-2 text-sm font-medium text-popover-foreground opacity-0 shadow-lg ring-1 ring-border transition-all duration-200 group-hover:-top-14 group-hover:opacity-100">
                                       Waiting for players to join teams...
                                       <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-popover ring-1 ring-border" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }} />
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </div>

                             {formationState === "open" && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-inner">
                                   <div className="mb-4 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                         <h3 className="text-lg font-semibold text-amber-500">Unassigned Pool</h3>
                                         <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                         </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                         <span className="font-mono text-base font-bold text-amber-500">
                                            {assignedCount}/{players.length} Assigned
                                         </span>
                                         {unassignedPlayers.length > 0 && (
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              onClick={() => void live.onAutoAssignTeams?.()}
                                              className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                                            >
                                              Balance Teams
                                            </Button>
                                         )}
                                      </div>
                                   </div>
                                   
                                   <div className="flex flex-wrap gap-2">
                                      {unassignedPlayers.length === 0 ? (
                                         <div className="w-full rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/10 py-4 text-center text-emerald-500">
                                            <p className="font-medium flex items-center justify-center gap-2">
                                               All players have chosen a team!
                                            </p>
                                         </div>
                                      ) : (
                                         unassignedPlayers.map(p => (
                                            <span key={p.account_id} className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
                                               <Users className="h-4 w-4 text-muted-foreground" />
                                               {p.name}
                                            </span>
                                         ))
                                      )}
                                   </div>
                                </div>
                             )}
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {teams.map(t => {
                                 if (!t || !t.$isLoaded) return null
                                 const teamPlayers = players.filter((p): p is Loaded<typeof SessionPlayer> => !!p && p.$isLoaded && p.team_id === t.id)
                                 const leader = teamPlayers.find(p => p && p.$isLoaded && p.account_id === t.leader_account_id) as Loaded<typeof SessionPlayer> | undefined
                                 return (
                                     <div key={t.id} className={cn("rounded-xl border-2 p-5 flex flex-col gap-4 shadow-sm", t.color)}>
                                        <div className="flex items-center justify-between">
                                           <h3 className="text-xl font-bold">{t.name}</h3>
                                           <span className="font-mono font-bold bg-background/50 px-2.5 py-1 rounded-full text-sm">
                                             {teamPlayers.length} members
                                           </span>
                                        </div>
                                        
                                        {formationState === "setup" ? (
                                           <div className="bg-background/80 p-3 rounded-lg border border-border/50">
                                              <p className="text-xs font-semibold mb-2 opacity-70 uppercase tracking-wider text-[var(--tw-prose-body)]">Assign Leader</p>
                                              <select 
                                                 className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                                                 value={t.leader_account_id || ""}
                                                 onChange={(e) => void live.onAssignTeamLeader?.(t.id, e.target.value || undefined)}
                                              >
                                                <option value="">-- Choose a leader --</option>
                                                {players.map(player => {
                                                   if (!player || !player.$isLoaded) return null
                                                   const p = player as Loaded<typeof SessionPlayer>
                                                   return (
                                                      <option key={p.account_id} value={p.account_id}>{p.name}</option>
                                                   )
                                                })}
                                              </select>
                                           </div>
                                        ) : (
                                           <div className="bg-background/80 p-3 rounded-lg border border-border/50">
                                              <p className="text-xs font-semibold mb-2 opacity-70 uppercase tracking-wider text-[var(--tw-prose-body)]">Leader</p>
                                              <div className="font-medium text-sm flex items-center gap-2">
                                                <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> 
                                                <span className="text-foreground">{leader ? leader.name : "None assigned"}</span>
                                              </div>
                                           </div>
                                        )}
                                        
                                        <div className="flex-1 mt-2">
                                           <p className="text-xs font-semibold mb-2 opacity-70 uppercase tracking-wider text-[var(--tw-prose-body)]">Roster</p>
                                           <div className="flex flex-wrap gap-2">
                                              {teamPlayers.filter(p => !leader || (p && p.$isLoaded && p.account_id !== leader.account_id)).map(p => {
                                                 if (!p || !p.$isLoaded) return null
                                                 return <span key={p.account_id} className="text-sm bg-background/80 text-foreground px-2 py-1 rounded-md border border-border/40">{p.name}</span>
                                              })}
                                              {teamPlayers.length === 0 && <span className="text-sm italic opacity-50 text-[var(--tw-prose-body)]">Empty</span>}
                                              {teamPlayers.length === 1 && leader && <span className="text-sm italic opacity-50 text-[var(--tw-prose-body)]">No regular members yet</span>}
                                           </div>
                                        </div>
                                     </div>
                                 )
                              })}
                           </div>

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
