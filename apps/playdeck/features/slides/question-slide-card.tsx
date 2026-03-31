"use client"

import { useMemo, useState } from "react"

import type { QuestionBlock } from "@/features/decks/parse-slide-question"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import { Button, cn } from "@beyond/design-system"

export type QuestionSlideVariant = "preview" | "audience" | "presenter"
export type QuestionSlideLayout = "card" | "overlay"
export type QuestionCardState = "idle" | "open" | "revealed"

type QuestionOptionOrderRow = {
  canonicalIndex: number
  text: string
  isCorrect: boolean
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
  return `${n} answered`
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border transition-colors",
        row.isCorrect
          ? "border-primary/65 bg-primary/8 ring-1 ring-primary/20"
          : "border-border/90 bg-card",
        myPick && "ring-2 ring-primary/35",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
          frac >= 0.999 ? "rounded-3xl" : "rounded-l-3xl",
          row.isCorrect ? "bg-primary/30" : "bg-muted/55",
        )}
        style={{ width: `${frac * 100}%` }}
        aria-hidden
      />
      <div className="relative z-10 flex gap-3 px-4 py-4">
        <span
          className={cn(
            "mt-0.5 w-4 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground",
            row.isCorrect && "font-semibold text-foreground",
          )}
        >
          {indexLabel}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-base leading-snug" data-question-option-text>
            <InlineMd markdown={row.text} className="[&_p]:mb-0 [&_p]:inline" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {row.isCorrect ? (
              <span className="rounded-full bg-primary/12 px-2 py-1 font-medium text-primary">
                Correct answer
              </span>
            ) : null}
            {myPick ? (
              <span className="rounded-full bg-muted/80 px-2 py-1 font-medium text-foreground">
                Your answer
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "tabular-nums text-sm text-muted-foreground",
              row.isCorrect && "font-semibold text-foreground",
            )}
          >
            {formatPercent(frac)}
          </p>
          <p className="mt-1 tabular-nums text-xs text-muted-foreground">
            {count}
          </p>
        </div>
      </div>
    </div>
  )
}

export function QuestionSlideCard({
  block,
  variant,
  state,
  layout = "card",
  counts,
  answeredCount,
  myAnswer,
  audienceAccountId,
  onSubmit,
  submitPending,
  submitError,
  accountReady = true,
  onStart,
  onStop,
}: {
  block: QuestionBlock
  variant: QuestionSlideVariant
  state: QuestionCardState
  layout?: QuestionSlideLayout
  counts: number[]
  answeredCount: number
  myAnswer: number | null
  audienceAccountId?: string
  onSubmit?: (canonicalIndex: number) => void
  submitPending?: boolean
  submitError?: string | null
  accountReady?: boolean
  onStart?: () => void
  onStop?: () => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const overlay = layout === "overlay"
  const orderedRows = useMemo(
    () => shuffledQuestionRows(block, audienceAccountId, variant),
    [audienceAccountId, block, variant],
  )

  const showPreview = variant === "preview"
  const showIdle = variant !== "preview" && state === "idle"
  const showAudienceSelection =
    variant === "audience" && state === "open" && myAnswer == null
  const showAudienceSubmitted =
    variant === "audience" && state === "open" && myAnswer != null
  const showPresenterQuestion =
    variant === "presenter" && (state === "idle" || state === "open")
  const showPresenterOpen = variant === "presenter" && state === "open"
  const showResults = state === "revealed"
  const totalAnswers = counts.reduce((sum, count) => sum + count, 0)
  const myRow = orderedRows.find((row) => row.canonicalIndex === myAnswer) ?? null
  const selectedRow =
    orderedRows.find((row) => row.canonicalIndex === selected) ?? null

  return (
    <article
      className={cn(
        "w-full",
        overlay
          ? "max-w-lg px-0 py-0"
          : "max-w-4xl rounded-xl border border-border/80 bg-card/40 px-4 py-4",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          overlay ? "mb-6" : "mb-3",
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
          {block.title ? (
            <p className="text-sm font-medium text-foreground/90">{block.title}</p>
          ) : null}
        </div>
        {variant === "presenter" && overlay ? (
          showIdle ? (
            onStart ? (
              <Button type="button" variant="outline" size="sm" onClick={onStart}>
                Start
              </Button>
            ) : null
          ) : showPresenterOpen ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatAnsweredCount(answeredCount)}
              </span>
              {onStop ? (
                <Button type="button" variant="outline" size="sm" onClick={onStop}>
                  Stop
                </Button>
              ) : null}
            </div>
          ) : state === "revealed" ? (
            <span className="text-xs text-muted-foreground">Final results</span>
          ) : null
        ) : null}
      </div>

      {showIdle && variant === "audience" ? (
        <div className="rounded-3xl border border-border/80 bg-card/60 px-5 py-6 text-center">
          <p className="text-base font-medium text-foreground">
            Question coming up
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Start the question when you are ready for the audience to answer.
          </p>
        </div>
      ) : null}

      {showAudienceSubmitted ? (
        <div className="rounded-3xl border border-border/80 bg-card/60 px-5 py-6 text-center">
          <p className="text-base font-medium text-foreground">
            Thanks, your answer has been submitted.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Waiting for the presenter to reveal the results.
          </p>
          {myRow ? (
            <div className="mt-4 rounded-2xl border border-border/80 bg-background/70 px-4 py-3 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Your answer
              </p>
              <div className="text-sm leading-relaxed text-foreground">
                <InlineMd markdown={myRow.text} className="[&_p]:mb-0 [&_p]:inline" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {showAudienceSelection || showPreview || showResults || showPresenterQuestion ? (
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
                "prose prose-invert max-w-none prose-p:leading-relaxed",
                overlay && "prose-p:text-2xl prose-p:font-medium md:prose-p:text-3xl",
              )}
              dangerouslySetInnerHTML={{
                __html: slideMarkdownToSafeHtml(block.prompt),
              }}
            />
          </div>

          <ul className={cn(overlay ? "mb-6 space-y-3" : "mb-4 space-y-3")}>
            {orderedRows.map((row, displayIndex) => {
              const id = `${block.questionKey}-${layout}-question-${row.canonicalIndex}`
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
                  ) : showPreview || showPresenterQuestion ? (
                    <div className="rounded-3xl border border-border/90 bg-card/70 px-4 py-4">
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
                  ) : (
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-3xl border border-border/90 bg-card/70 px-4 py-4 transition-colors",
                        selected === row.canonicalIndex &&
                          "border-primary ring-2 ring-primary/35 bg-muted/20",
                        "hover:border-ring/50 hover:bg-muted/25",
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name={`${block.questionKey}-${layout}`}
                        checked={selected === row.canonicalIndex}
                        onChange={() => setSelected(row.canonicalIndex)}
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
                    </label>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {showIdle && variant === "presenter" ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Presenter preview — start the question when you want the audience to answer.
        </p>
      ) : null}

      {showPresenterOpen ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Answers are coming in live. Stop the question to reveal the results.
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
          {variant === "audience" && myAnswer != null ? (
            <span className="font-medium text-foreground">
              {block.options[myAnswer]?.isCorrect
                ? "You answered correctly."
                : "You answered incorrectly."}
            </span>
          ) : null}
        </div>
      ) : null}

      {submitError ? (
        <p className={cn("text-sm text-destructive", overlay && "text-center")}>
          {submitError}
        </p>
      ) : null}

      {showAudienceSelection ? (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            size={overlay ? "default" : "sm"}
            disabled={selected == null || submitPending || !accountReady || !onSubmit}
            onClick={() => {
              if (selected == null || !onSubmit) return
              onSubmit(selected)
            }}
          >
            {submitPending
              ? "Submitting…"
              : !accountReady
                ? "Connecting…"
                : selectedRow
                  ? "Submit answer"
                  : "Select an answer"}
          </Button>
        </div>
      ) : null}
    </article>
  )
}
