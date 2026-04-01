"use client"

import { useState } from "react"

import type { PollBlock } from "@/features/decks/parse-slide-poll"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import { Button, cn } from "@beyond/design-system"

function InlineMd({ markdown, className }: { markdown: string; className?: string }) {
  const html = slideMarkdownToSafeHtml(markdown)
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function formatPollPercent(frac: number): string {
  if (frac <= 0) return "0%"
  return `${(frac * 100).toFixed(1)}%`
}

export type PollSlideVariant = "preview" | "audience" | "presenter"

export type PollSlideLayout = "card" | "overlay"

type OverlayOptionMode = "selecting" | "results"

function audienceGridColsClass(optionCount: number): string {
  return optionCount >= 5 ? "grid-cols-3" : "grid-cols-2"
}

const theaterPromptProseClass =
  "question-theater-prompt w-full max-w-none px-5 text-center text-primary-foreground sm:px-8"

function AudienceTheaterPollPrompt({ block }: { block: PollBlock }) {
  const html = slideMarkdownToSafeHtml(block.prompt)

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center overflow-y-auto bg-primary",
        "min-h-[min(40vh,44%)] py-5 sm:min-h-[min(36vh,40%)] sm:py-6 md:py-7",
        "text-primary-foreground",
      )}
    >
      <div
        className={theaterPromptProseClass}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function OverlayPollOptionRow({
  id,
  name,
  optionMarkdown,
  optionIndex,
  mode,
  selected,
  onSelect,
  frac,
  voteCount,
  isWinner,
  myPick,
}: {
  id: string
  name: string
  optionMarkdown: string
  optionIndex: number
  mode: OverlayOptionMode
  selected: boolean
  onSelect: () => void
  frac: number
  voteCount: number
  isWinner: boolean
  myPick: boolean
}) {
  const showRatioFill = mode === "results"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-none border border-border/90 transition-colors",
        mode === "selecting" &&
        "bg-card/70 hover:border-ring/50 hover:bg-muted/25",
        mode === "selecting" &&
        selected &&
        "border-primary ring-2 ring-primary/35 bg-muted/20",
        mode === "results" && "bg-card",
        mode === "results" && myPick && "border-primary ring-2 ring-primary/40",
      )}
    >
      {showRatioFill ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 top-0 transition-[width] duration-500 ease-out",
            "rounded-none",
            isWinner ? "bg-primary/35" : "bg-muted/55",
          )}
          style={{ width: `${frac * 100}%` }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-10 min-h-0">
        {mode === "selecting" ? (
          <label htmlFor={id} className="flex cursor-pointer gap-3 px-4 py-4">
            <input
              type="radio"
              id={id}
              name={name}
              checked={selected}
              onChange={onSelect}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-base leading-snug">
                <InlineMd
                  markdown={optionMarkdown}
                  className="[&_p]:mb-0 [&_p]:inline"
                />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out"
                  style={{ width: `${frac * 100}%` }}
                />
              </div>
              <div className="flex justify-end">
                <span className="tabular-nums text-xs text-muted-foreground">
                  {voteCount} {voteCount === 1 ? "response" : "responses"}
                </span>
              </div>
            </div>
          </label>
        ) : (
          <div className="flex gap-3 px-4 py-4">
            <span
              className={cn(
                "mt-1 w-4 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground",
                isWinner && "font-semibold text-foreground",
              )}
            >
              {optionIndex + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-base leading-snug",
                  isWinner && "font-semibold",
                )}
              >
                <InlineMd
                  markdown={optionMarkdown}
                  className="[&_p]:mb-0 [&_p]:inline"
                />
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 tabular-nums text-sm text-muted-foreground",
                isWinner && "font-semibold text-foreground",
              )}
            >
              {formatPollPercent(frac)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function PollSlideCard({
  block,
  variant,
  layout = "card",
  counts,
  myVote,
  name,
  onVote,
  voteError,
  votePending,
  voteAccountReady = true,
  pollClosed = false,
  onClosePoll,
}: {
  block: PollBlock
  variant: PollSlideVariant
  layout?: PollSlideLayout
  counts: number[]
  myVote: number | null
  name: string
  onVote?: (optionIndex: number) => void
  voteError?: string | null
  votePending?: boolean
  /** When false, submit is disabled (e.g. Jazz account still loading). */
  voteAccountReady?: boolean
  pollClosed?: boolean
  onClosePoll?: () => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const totalVotes = counts.reduce((a, b) => a + b, 0)
  const canVote = variant === "audience"
  const showPollRadios = canVote && myVote == null && !pollClosed
  const showVoteButton = showPollRadios && selected != null
  const overlay = layout === "overlay"
  const audienceTheater = overlay && variant === "audience"
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0
  const overlayMode: OverlayOptionMode = showPollRadios ? "selecting" : "results"

  if (audienceTheater) {
    const orderedOptions = block.options.map((opt, index) => ({ opt, index }))
    const showAudienceSelection = myVote == null && !pollClosed
    const showAudienceSubmitted = myVote != null && !pollClosed
    const showResults = pollClosed
    const gridCols = audienceGridColsClass(orderedOptions.length)
    const submitDisabled = votePending || !voteAccountReady || !onVote
    const myOption = myVote != null ? block.options[myVote] : null

    return (
      <article className="flex h-full min-h-0 w-full flex-col">
        {showAudienceSubmitted ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-2xl font-bold text-foreground">Response received!</p>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
              Hang tight! Results will be revealed once everyone has finished.
            </p>
            {myOption ? (
              <div className="w-full max-w-md rounded-none border border-border/80 bg-card/80 px-5 py-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Your choice
                </p>
                <div className="text-lg font-medium leading-relaxed text-foreground">
                  <InlineMd markdown={myOption} className="[&_p]:mb-0 [&_p]:inline" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {showAudienceSelection ? (
          <>
            <AudienceTheaterPollPrompt block={block} />
            <div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-0", gridCols)}>
              {orderedOptions.map(({ opt, index }, displayIndex) => {
                const spanThird =
                  orderedOptions.length === 3 && displayIndex === 2 ? "col-span-2" : ""
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={submitDisabled}
                    className={cn(
                      "flex min-h-0 flex-col items-center justify-center rounded-none border border-foreground/25 bg-card px-3 py-4 text-center text-base font-medium leading-snug text-foreground transition-[opacity,transform,filter] sm:px-4 sm:py-5 sm:text-base",
                      spanThird,
                      submitDisabled && "cursor-not-allowed opacity-60",
                      !submitDisabled && "cursor-pointer hover:brightness-105 active:scale-[0.99]",
                    )}
                    onClick={() => {
                      if (submitDisabled || !onVote) return
                      onVote(index)
                    }}
                  >
                    <span className="line-clamp-6 wrap-anywhere" data-question-option-text>
                      <InlineMd markdown={opt} className="[&_p]:mb-0 [&_p]:inline" />
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        {showResults ? (
          <>
            <AudienceTheaterPollPrompt block={block} />
            <div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-0", gridCols)}>
              {orderedOptions.map(({ opt, index }, displayIndex) => {
                const n = counts[index] ?? 0
                const frac = totalVotes > 0 ? n / totalVotes : 0
                const spanThird =
                  orderedOptions.length === 3 && displayIndex === 2 ? "col-span-2" : ""
                const myPick = myVote === index
                return (
                  <div
                    key={index}
                    className={cn(
                      "relative flex min-h-28 min-w-0 flex-col overflow-hidden rounded-none border border-foreground/25 bg-card text-foreground",
                      spanThird,
                      myPick && "ring-2 ring-primary/45",
                    )}
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-none bg-primary/25 transition-[width] duration-500 ease-out"
                      style={{ width: `${frac * 100}%` }}
                      aria-hidden
                    />
                    <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="tabular-nums text-xs font-medium opacity-80">
                          {displayIndex + 1}
                        </span>
                        {myPick ? (
                          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Your choice
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 text-sm font-medium leading-snug sm:text-base">
                        <InlineMd markdown={opt} className="[&_p]:mb-0 [&_p]:inline" />
                      </div>
                      <div className="flex items-end justify-between gap-2 tabular-nums">
                        <span className="text-sm font-semibold">{formatPollPercent(frac)}</span>
                        <span className="text-xs opacity-90">{n}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground sm:px-4">
              <span>{totalVotes} responses</span>
            </div>
          </>
        ) : null}

        {voteError ? (
          <p className="shrink-0 px-3 pb-2 text-center text-sm text-destructive sm:px-4">
            {voteError}
          </p>
        ) : null}
      </article>
    )
  }

  return (
    <article
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live Poll
        </p>
        {variant === "presenter" && overlay ? (
          pollClosed ? (
            <span className="text-xs text-muted-foreground">Final results</span>
          ) : onClosePoll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={onClosePoll}
            >
              End Poll
            </Button>
          ) : null
        ) : null}
      </div>

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

        <ul className={cn(overlay ? "mb-8 space-y-3" : "mb-4 space-y-3")}>
          {block.options.map((opt, i) => {
            const id = `${name}-opt-${i}`
            const n = counts[i] ?? 0
            const frac = totalVotes > 0 ? n / totalVotes : 0
            const isWinner = totalVotes > 0 && n === maxCount && maxCount > 0
            const myPick = variant === "audience" && myVote === i
            return (
              <li key={i} className="space-y-1.5">
                {overlay ? (
                  <OverlayPollOptionRow
                    id={id}
                    name={name}
                    optionMarkdown={opt}
                    optionIndex={i}
                    mode={overlayMode}
                    selected={selected === i}
                    onSelect={() => setSelected(i)}
                    frac={frac}
                    voteCount={n}
                    isWinner={isWinner}
                    myPick={myPick}
                  />
                ) : (
                  <div className="flex gap-2">
                    {showPollRadios ? (
                      <input
                        type="radio"
                        id={id}
                        name={name}
                        checked={selected === i}
                        onChange={() => setSelected(i)}
                        className="mt-1.5 size-4 shrink-0 accent-foreground"
                      />
                    ) : null}
                    <div
                      className={cn(
                        "min-w-0 flex-1 space-y-1",
                        showPollRadios &&
                        selected === i &&
                        "rounded-none ring-2 ring-primary/40",
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-5 shrink-0 font-medium tabular-nums text-muted-foreground">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <InlineMd
                            markdown={opt}
                            className="inline [&_p]:mb-0 [&_p]:inline"
                          />
                        </div>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {n}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted/80 pl-7">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out"
                          style={{ width: `${frac * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {variant === "preview" ? (
        <p
          className={cn(
            "text-muted-foreground",
            overlay ? "text-center text-xs" : "mb-2 text-xs",
          )}
        >
          Draft preview — results will be visible during the live session.
        </p>
      ) : null}

      {voteError ? (
        <p className={cn("text-sm text-destructive", overlay && "text-center")}>
          {voteError}
        </p>
      ) : null}

      {showVoteButton ? (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            size={overlay ? "default" : "sm"}
            className="rounded-none"
            disabled={votePending || !voteAccountReady || onVote == null}
            onClick={() => {
              if (selected == null || !onVote) return
              onVote(selected)
            }}
          >
            {votePending
              ? "Casting…"
              : !voteAccountReady
                ? "Connecting…"
                : "Cast vote"}
          </Button>
        </div>
      ) : null}
    </article>
  )
}
