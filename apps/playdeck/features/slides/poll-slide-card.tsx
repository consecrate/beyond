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
        "relative overflow-hidden rounded-3xl border border-border/90 transition-colors",
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
            frac >= 0.999 ? "rounded-3xl" : "rounded-l-3xl",
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
                  {voteCount} {voteCount === 1 ? "vote" : "votes"}
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
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0
  const overlayMode: OverlayOptionMode = showPollRadios ? "selecting" : "results"

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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Poll
        </p>
        {variant === "presenter" && overlay ? (
          pollClosed ? (
            <span className="text-xs text-muted-foreground">Final results</span>
          ) : onClosePoll ? (
            <Button type="button" variant="outline" size="sm" onClick={onClosePoll}>
              Close
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
                          "rounded-md ring-2 ring-primary/40",
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
          Preview — poll results appear when you go live.
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
            disabled={votePending || !voteAccountReady || onVote == null}
            onClick={() => {
              if (selected == null || !onVote) return
              onVote(selected)
            }}
          >
            {votePending
              ? "Saving…"
              : !voteAccountReady
                ? "Connecting…"
                : "Submit vote"}
          </Button>
        </div>
      ) : null}
    </article>
  )
}
