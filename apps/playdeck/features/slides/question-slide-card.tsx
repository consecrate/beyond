"use client"

import { useContext, useMemo, useRef } from "react"

import type { Loaded } from "jazz-tools"
import type { QuestionBlock } from "@/features/decks/parse-slide-question"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import { PlaydeckAccount } from "@/features/jazz/schema"
import { useJazzImages } from "@/features/slides/use-jazz-images"
import { Button, cn } from "@beyond/design-system"
import { JazzContext } from "jazz-tools/react-core"
import { useAccount } from "jazz-tools/react"

export type QuestionSlideVariant = "preview" | "audience" | "presenter"
export type QuestionSlideLayout = "card" | "overlay"
export type QuestionCardState = "idle" | "open" | "revealed"

type QuestionOptionOrderRow = {
  canonicalIndex: number
  text: string
  isCorrect: boolean
}

type QuestionResultTone = "correct" | "wrong"

const questionResultToneClasses: Record<
  QuestionResultTone,
  { container: string; fill: string }
> = {
  correct: {
    container:
      "border-emerald-600/50 bg-emerald-500/12 dark:border-emerald-500/45 dark:bg-emerald-500/18",
    fill: "bg-emerald-600/30 dark:bg-emerald-500/35",
  },
  wrong: {
    container:
      "border-red-500/45 bg-red-500/12 dark:border-red-500/45 dark:bg-red-500/18",
    fill: "bg-red-500/35 dark:bg-red-500/35",
  },
}

function InlineMd({ markdown, className }: { markdown: string; className?: string }) {
  const html = slideMarkdownToSafeHtml(markdown)
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function formatPercent(frac: number): string {
  if (frac <= 0) return "0%"
  return `${(frac * 100).toFixed(1)}%`
}

function formatAnsweredCount(n: number): string {
  return `${n} responses`
}

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffledQuestionRows(
  block: QuestionBlock,
  audienceAccountId: string | undefined,
  variant: QuestionSlideVariant,
): QuestionOptionOrderRow[] {
  const rows = block.options.map((option, canonicalIndex) => ({
    canonicalIndex,
    text: option.text,
    isCorrect: option.isCorrect,
  }))

  if (variant !== "audience" || !audienceAccountId) {
    return rows
  }

  const next = [...rows]
  const rand = mulberry32(hashSeed(`${block.questionKey}:${audienceAccountId}`))
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function QuestionResultsRow({
  indexLabel,
  row,
  count,
  totalAnswers,
  myPick,
}: {
  indexLabel: number
  row: QuestionOptionOrderRow
  count: number
  totalAnswers: number
  myPick: boolean
}) {
  const frac = totalAnswers > 0 ? count / totalAnswers : 0
  const tone: QuestionResultTone = row.isCorrect ? "correct" : "wrong"
  const toneClasses = questionResultToneClasses[tone]

  return (
    <div
      data-question-result-tone={tone}
      className={cn(
        "relative overflow-hidden rounded-none border transition-colors",
        toneClasses.container,
        myPick && "ring-2 ring-amber-500/50 dark:ring-amber-400/45",
      )}
    >
      <div
        data-question-result-fill={tone}
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
          "rounded-none",
          toneClasses.fill,
        )}
        style={{ width: `${frac * 100}%` }}
        aria-hidden
      />
      <div className="relative z-10 flex gap-3 px-4 py-4">
        <span className="mt-0.5 w-4 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
          {indexLabel}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-base leading-snug" data-question-option-text>
            <InlineMd markdown={row.text} className="[&_p]:mb-0 [&_p]:inline" />
          </div>
          {myPick ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-muted/80 px-2 py-1 font-medium text-foreground">
                Your choice
              </span>
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-sm text-muted-foreground">{formatPercent(frac)}</p>
        </div>
      </div>
    </div>
  )
}

/** Neutral/default audience tile style for viewer-facing MCQ options. */
function audienceOptionTileClass(): string {
  return "bg-card text-foreground"
}

function audienceGridColsClass(optionCount: number): string {
  return optionCount >= 5 ? "grid-cols-3" : "grid-cols-2"
}

/** Shared Kahoot/Gimkit-style prompt typography for the colored question band. */
const theaterPromptProseClass =
  "question-theater-prompt w-full max-w-none px-5 text-center text-primary-foreground sm:px-8"

function AudienceTheaterQuestionStrip({ block }: { block: QuestionBlock }) {
  const html = slideMarkdownToSafeHtml(block.prompt)

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center overflow-y-auto bg-primary",
        /* Slightly shorter band to give answer tiles more vertical room. */
        "min-h-[min(40vh,44%)] py-5 sm:min-h-[min(36vh,40%)] sm:py-6 md:py-7",
        "text-primary-foreground",
      )}
    >
      {block.kicker ? (
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/85 sm:mb-4 sm:text-sm">
          {block.kicker}
        </p>
      ) : null}
      <div
        className={theaterPromptProseClass}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function AudienceQuestionRevealFeedback({
  isCorrect,
  hasAnswered,
  correctRow,
}: {
  isCorrect: boolean
  hasAnswered: boolean
  correctRow: QuestionOptionOrderRow | null
}) {
  const toneClass = hasAnswered
    ? isCorrect
      ? "bg-emerald-500/12 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-50"
      : "bg-red-500/12 text-red-950 dark:bg-red-500/20 dark:text-red-50"
    : "bg-card text-foreground"

  const title = hasAnswered ? (isCorrect ? "Correct!" : "Incorrect") : "No response submitted"
  const subtitle = hasAnswered
    ? isCorrect
      ? "Nice work - you picked the right answer."
      : "You can still learn from this one."
    : "The question has ended. Here is the correct option."

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8", toneClass)}>
      <div className="w-full max-w-2xl space-y-5 text-center">
        <p className="text-3xl font-bold sm:text-4xl">{title}</p>
        {hasAnswered && isCorrect ? (
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            +20 PlayPoints Bonus!
          </p>
        ) : null}
        <p className="text-base leading-relaxed opacity-90 sm:text-lg">{subtitle}</p>
        <div className="mx-auto w-full max-w-xl rounded-none border border-current/25 bg-background/80 px-5 py-4 text-left text-foreground dark:bg-background/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Correct option
          </p>
          {correctRow ? (
            <div className="text-lg font-medium leading-relaxed">
              <InlineMd markdown={correctRow.text} className="[&_p]:mb-0 [&_p]:inline" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No correct option configured.</p>
          )}
        </div>
      </div>
    </div>
  )
}

type QuestionSlideCardProps = {
  block: QuestionBlock
  variant: QuestionSlideVariant
  state: QuestionCardState
  resultsVisible?: boolean
  layout?: QuestionSlideLayout
  counts: number[]
  answeredCount: number
  myAnswer: number | null
  audienceAccountId?: string
  /** When set, that option is omitted from the audience answer grid (e.g. 1/4 power-up). */
  audienceHideCanonicalOptionIndex?: number | null
  onSubmit?: (canonicalIndex: number) => void
  submitPending?: boolean
  submitError?: string | null
  accountReady?: boolean
  onStart?: () => void
  onStop?: () => void
  /** Presenter overlay only: CTA after reveal to advance (e.g. battle royale next round). */
  onPresenterNextQuestion?: () => void
  presenterNextQuestionLabel?: string
}

function QuestionSlideCardWithJazz(props: QuestionSlideCardProps) {
  const me = useAccount(PlaydeckAccount, {
    select: (account) => (account.$isLoaded ? account : null),
  })

  return <QuestionSlideCardContent {...props} me={me} />
}

function QuestionSlideCardContent({
  block,
  variant,
  state,
  resultsVisible,
  layout = "card",
  counts,
  answeredCount,
  myAnswer,
  audienceAccountId,
  audienceHideCanonicalOptionIndex,
  onSubmit,
  submitPending,
  submitError,
  accountReady = true,
  onStart,
  onStop,
  onPresenterNextQuestion,
  presenterNextQuestionLabel = "Next question",
  me,
}: QuestionSlideCardProps & {
  me: Loaded<typeof PlaydeckAccount> | null
}) {
  const overlay = layout === "overlay"
  const audienceTheater = overlay && variant === "audience"
  const articleRef = useRef<HTMLElement>(null)
  const orderedRows = useMemo(
    () => shuffledQuestionRows(block, audienceAccountId, variant),
    [audienceAccountId, block, variant],
  )
  const questionMarkdownKey = useMemo(
    () =>
      JSON.stringify([
        block.prompt,
        ...orderedRows.map((row) => row.text),
        variant,
        state,
        resultsVisible ?? null,
        myAnswer ?? null,
      ]),
    [block.prompt, myAnswer, orderedRows, resultsVisible, state, variant],
  )
  useJazzImages(articleRef, me, questionMarkdownKey)

  const audienceAnswerRows = useMemo(() => {
    if (
      audienceHideCanonicalOptionIndex == null ||
      audienceHideCanonicalOptionIndex < 0
    ) {
      return orderedRows
    }
    return orderedRows.filter(
      (row) => row.canonicalIndex !== audienceHideCanonicalOptionIndex,
    )
  }, [audienceHideCanonicalOptionIndex, orderedRows])

  const showPreview = variant === "preview"
  const showIdle = variant !== "preview" && state === "idle"
  const showAudienceSelection =
    variant === "audience" && state === "open" && myAnswer == null
  const showAudienceSubmitted =
    variant === "audience" && state === "open" && myAnswer != null
  const showResults = resultsVisible ?? state === "revealed"
  const showPresenterQuestion =
    variant === "presenter" && (state === "idle" || state === "open")
  const showPresenterOpen = variant === "presenter" && state === "open"
  const hideOptionRowsUntilReveal =
    overlay && variant === "presenter" && !showResults
  const totalAnswers = counts.reduce((sum, count) => sum + count, 0)
  const myRow = orderedRows.find((row) => row.canonicalIndex === myAnswer) ?? null
  const correctRow = orderedRows.find((row) => row.isCorrect) ?? null
  const revealedHasAnswer = myAnswer != null
  const revealedIsCorrect = myAnswer != null && block.options[myAnswer]?.isCorrect === true

  const canSubmit =
    Boolean(onSubmit) && accountReady && !submitPending

  if (audienceTheater) {
    const gridCols = audienceGridColsClass(audienceAnswerRows.length)
    const submitDisabled = !canSubmit

    return (
      <article ref={articleRef} className="flex h-full min-h-0 w-full flex-col">
        {showIdle ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-2xl font-bold text-foreground">Get ready!</p>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              The question will begin shortly. Stay tuned.
            </p>
          </div>
        ) : null}

        {showAudienceSubmitted ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-2xl font-bold text-foreground">Response received!</p>
            <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
              +10 PlayPoints
            </div>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              Hang tight! Results will be revealed once everyone has finished.
            </p>
            {myRow ? (
              <div className="w-full max-w-md rounded-none border border-border/80 bg-card/80 px-5 py-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Your choice
                </p>
                <div className="text-lg font-medium leading-relaxed text-foreground">
                  <InlineMd markdown={myRow.text} className="[&_p]:mb-0 [&_p]:inline" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showAudienceSelection ? (
          <>
            <AudienceTheaterQuestionStrip block={block} />
            <div
              className={cn(
                "grid min-h-0 flex-1 auto-rows-fr gap-0",
                gridCols,
              )}
            >
              {audienceAnswerRows.map((row, displayIndex) => {
                const tileClass = audienceOptionTileClass()
                const spanThird =
                  audienceAnswerRows.length === 3 && displayIndex === 2 ? "col-span-2" : ""
                return (
                  <button
                    key={row.canonicalIndex}
                    type="button"
                    disabled={submitDisabled}
                    className={cn(
                      "flex min-h-0 flex-col items-center justify-center rounded-none border border-foreground/25 px-3 py-4 text-center text-base font-medium leading-snug transition-[opacity,transform,filter] sm:px-4 sm:py-5 sm:text-base",
                      spanThird,
                      tileClass,
                      submitDisabled &&
                      "cursor-not-allowed opacity-60",
                      !submitDisabled &&
                      "cursor-pointer hover:brightness-105 active:scale-[0.99]",
                    )}
                    onClick={() => {
                      if (submitDisabled || !onSubmit) return
                      onSubmit(row.canonicalIndex)
                    }}
                  >
                    <span className="line-clamp-6 wrap-anywhere" data-question-option-text>
                      <InlineMd
                        markdown={row.text}
                        className="[&_p]:mb-0 [&_p]:inline" />
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        {showResults ? (
          <AudienceQuestionRevealFeedback
            isCorrect={revealedIsCorrect}
            hasAnswered={revealedHasAnswer}
            correctRow={correctRow}
          />
        ) : null}

        {submitError ? (
          <p className="shrink-0 px-3 pb-2 text-center text-sm text-destructive sm:px-4">
            {submitError}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <article
      ref={articleRef}
      className={cn(
        "w-full",
        overlay
          ? "max-w-lg px-0 py-0"
          : "max-w-4xl rounded-none border border-border/80 bg-card/40 px-4 py-4",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3"
        )}
      >
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Question
          </p>
          {block.kicker ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">
              {block.kicker}
            </p>
          ) : null}
        </div>
        {variant === "presenter" && overlay ? (
          showIdle ? (
            onStart ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={onStart}
              >
                Launch Question
              </Button>
            ) : null
          ) : showPresenterOpen ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatAnsweredCount(answeredCount)}
              </span>
              {onStop ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={onStop}
                >
                  End & Reveal
                </Button>
              ) : null}
            </div>
          ) : state === "revealed" ? (
            <span className="text-xs text-muted-foreground">
              {showResults ? "Final results" : "Question closed"}
            </span>
          ) : null
        ) : null}
      </div>

      {showPreview || showResults || showPresenterQuestion ? (
        <div className="space-y-3">
          <div
            className={cn(
              "leading-relaxed",
              overlay
                ? "text-2xl font-medium md:text-3xl [&_.prose]:text-foreground"
                : "text-sm",
            )}
          >
            <div
              className={cn(
                "question-overlay-prompt max-w-none",
                !overlay && "text-sm leading-relaxed",
              )}
              dangerouslySetInnerHTML={{
                __html: slideMarkdownToSafeHtml(block.prompt),
              }}
            />
          </div>

          {hideOptionRowsUntilReveal ? null : (
            <ul className={cn(overlay ? "mb-8 space-y-3" : "mb-4 space-y-3")}>
              {orderedRows.map((row, displayIndex) => {
                const count = counts[row.canonicalIndex] ?? 0
                const myPick = myAnswer === row.canonicalIndex
                return (
                  <li key={row.canonicalIndex}>
                    {showResults ? (
                      <QuestionResultsRow
                        indexLabel={displayIndex + 1}
                        row={row}
                        count={count}
                        totalAnswers={totalAnswers}
                        myPick={myPick}
                      />
                    ) : overlay ? (
                      <div className="relative overflow-hidden rounded-none border border-border/90 bg-card">
                        <div className="relative z-10 flex gap-3 px-4 py-4">
                          <span className="mt-1 w-4 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
                            {displayIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-base leading-snug"
                              data-question-option-text
                            >
                              <InlineMd
                                markdown={row.text}
                                className="[&_p]:mb-0 [&_p]:inline"
                              />
                            </div>
                          </div>
                          <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                            {formatPercent(0)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-none border border-border/90 bg-card/70 px-4 py-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Answer {displayIndex + 1}
                        </p>
                        <div
                          className="text-base leading-snug"
                          data-question-option-text
                        >
                          <InlineMd
                            markdown={row.text}
                            className="[&_p]:mb-0 [&_p]:inline"
                          />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {showIdle && variant === "presenter" ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Preview mode — Launch the question when you want the audience to participate.
        </p>
      ) : null}

      {showPresenterOpen ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Responses are coming in live. End the question to reveal results and the correct answer.
        </p>
      ) : null}

      {variant === "preview" ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Preview — start the question live to let the audience answer.
        </p>
      ) : null}

      {showResults ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
            overlay && "justify-between",
          )}
        >
          <span>{formatAnsweredCount(answeredCount)}</span>
        </div>
      ) : null}

      {variant === "presenter" &&
      overlay &&
      showResults &&
      onPresenterNextQuestion ? (
        <div
          className={cn(
            "mt-6 flex w-full",
            overlay ? "justify-center" : "",
          )}
        >
          <Button
            type="button"
            variant="default"
            size="lg"
            className={cn(overlay && "rounded-none px-8")}
            onClick={onPresenterNextQuestion}
          >
            {presenterNextQuestionLabel}
          </Button>
        </div>
      ) : null}

      {submitError ? (
        <p className={cn("text-sm text-destructive", overlay && "text-center")}>
          {submitError}
        </p>
      ) : null}
    </article>
  )
}

export function QuestionSlideCard(props: QuestionSlideCardProps) {
  const jazzContext = useContext(JazzContext)

  if (!jazzContext) {
    return <QuestionSlideCardContent {...props} me={null} />
  }

  return <QuestionSlideCardWithJazz {...props} />
}
