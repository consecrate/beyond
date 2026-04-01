"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"
import { buttonVariants, cn } from "@beyond/design-system"
import Link from "next/link"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import {
  aggregatePollCounts,
  aggregateQuestionCounts,
  countQuestionAnswers,
  isPollClosed,
  myPollVote,
  myQuestionAnswer,
  questionStatus,
  submitQuestionAnswer,
  upsertPollVote,
  joinLiveSession,
} from "@/features/jazz/live-session-mutations"
import { PlaydeckAccount, type LiveSession } from "@/features/jazz/schema"
import { RevealSlideBody } from "@/features/slides/deck-reveal-presenter"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

export type LiveRevealFollowerProps = {
  /** Keys the Reveal subtree so Strict Mode / destroy() get a fresh DOM per session. */
  sessionId: string
  deckTitle: string
  slides: RevealSlideModel[]
  activeSlideIndex: number
  liveSession: Loaded<typeof LiveSession>
}

export function LiveRevealFollower({
  sessionId,
  deckTitle,
  slides,
  activeSlideIndex,
  liveSession,
}: LiveRevealFollowerProps) {
  const me = useAccount(PlaydeckAccount)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [votePending, startVote] = useTransition()
  const [questionErrorState, setQuestionErrorState] = useState<{
    questionKey: string | null
    message: string | null
  }>({ questionKey: null, message: null })
  const [questionPending, startQuestionSubmit] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Must match Reveal's current slide for RevealSlideBody lazy window (not only Jazz index). */
  const [revealIndex, setRevealIndex] = useState(0)
  const revealRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const activeSlideIndexRef = useRef(activeSlideIndex)
  const numSlides = slides.length
  const activeQuestionKey = slides[revealIndex]?.question?.questionKey ?? null
  const questionError =
    activeQuestionKey != null &&
      questionErrorState.questionKey === activeQuestionKey
      ? questionErrorState.message
      : null

  const userId = me.$isLoaded ? me.$jazz.id : ""

  const [isKicked, setIsKicked] = useState(false)
  const hasJoinedRef = useRef(false)

  useEffect(() => {
    if (!me.$isLoaded || !liveSession || !liveSession.joined_players) return

    assertLoaded(liveSession.joined_players)
    const playersArr = [...liveSession.joined_players]
    const isCurrentlyIn = playersArr.some((p) => {
      if (!p) return false
      assertLoaded(p)
      return p.account_id === me.$jazz.id
    })

    if (!hasJoinedRef.current) {
      if (!isCurrentlyIn) {
        joinLiveSession(me, liveSession)
      }
      hasJoinedRef.current = true
    } else {
      if (!isCurrentlyIn) {
        setIsKicked(true)
      }
    }
  }, [me, liveSession])

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
      slideNumber: false,
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

  if (isKicked) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">You have been kicked</h2>
        <p className="max-w-sm text-sm text-muted-foreground mb-4">
          The presenter has removed you from this session.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Return to Homepage
        </Link>
      </div>
    )
  }

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
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {loadError ? (
          <p className="p-6 text-center text-sm text-destructive">{loadError}</p>
        ) : (
          <>
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
                          slide={slide}
                          slideIndex={i}
                          activeIndex={revealIndex}
                        />
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {slides[revealIndex]?.interactiveError ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    <InteractiveErrorCard
                      layout="overlay"
                      title={slides[revealIndex].title}
                      message={slides[revealIndex].interactiveError!.message}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {slides[revealIndex]?.poll ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
                  <PollSlideCard
                    layout="overlay"
                    block={slides[revealIndex].poll!}
                    variant="audience"
                    counts={aggregatePollCounts(
                      liveSession,
                      slides[revealIndex].poll!.pollKey,
                      slides[revealIndex].poll!.options.length,
                    )}
                    myVote={myPollVote(
                      liveSession,
                      userId,
                      slides[revealIndex].poll!.pollKey,
                    )}
                    pollClosed={isPollClosed(
                      liveSession,
                      slides[revealIndex].poll!.pollKey,
                    )}
                    name={`join-poll-${sessionId}-${revealIndex}`}
                    voteError={voteError}
                    votePending={votePending}
                    voteAccountReady={me.$isLoaded}
                    onVote={(optionIndex) => {
                      setVoteError(null)
                      startVote(() => {
                        if (!me.$isLoaded) {
                          setVoteError(
                            "Still connecting. Try again in a moment.",
                          )
                          return
                        }
                        assertLoaded(me)
                        const r = upsertPollVote(me, liveSession, {
                          pollKey: slides[revealIndex].poll!.pollKey,
                          optionIndex,
                          optionCount:
                            slides[revealIndex].poll!.options.length,
                        })
                        if (!r.ok) setVoteError(r.error)
                      })
                    }}
                  />
                </div>
              </div>
            ) : null}

            {slides[revealIndex]?.question ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
                  {(() => {
                    const question = slides[revealIndex].question!
                    const state = questionStatus(liveSession, question.questionKey)
                    const resultsVisible =
                      state === "revealed" && liveSession.status === "ended"
                    const counts = resultsVisible
                      ? aggregateQuestionCounts(
                        liveSession,
                        question.questionKey,
                        question.options.length,
                      )
                      : Array.from({ length: question.options.length }, () => 0)

                    return (
                      <QuestionSlideCard
                        layout="overlay"
                        block={question}
                        variant="audience"
                        state={state}
                        resultsVisible={resultsVisible}
                        counts={counts}
                        answeredCount={countQuestionAnswers(
                          liveSession,
                          question.questionKey,
                        )}
                        myAnswer={myQuestionAnswer(
                          liveSession,
                          userId,
                          question.questionKey,
                        )}
                        audienceAccountId={userId}
                        submitError={questionError}
                        submitPending={questionPending}
                        accountReady={me.$isLoaded}
                        onSubmit={(optionIndex) => {
                          setQuestionErrorState({
                            questionKey: question.questionKey,
                            message: null,
                          })
                          startQuestionSubmit(() => {
                            if (!me.$isLoaded) {
                              setQuestionErrorState({
                                questionKey: question.questionKey,
                                message: "Still connecting. Try again in a moment.",
                              })
                              return
                            }
                            assertLoaded(me)
                            const result = submitQuestionAnswer(me, liveSession, {
                              questionKey: question.questionKey,
                              optionIndex,
                              optionCount: question.options.length,
                            })
                            if (!result.ok) {
                              setQuestionErrorState({
                                questionKey: question.questionKey,
                                message: result.error,
                              })
                            }
                          })
                        }}
                      />
                    )
                  })()}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
