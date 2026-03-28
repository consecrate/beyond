"use client"

import { useCallback, useState } from "react"
import { CircleHelp } from "lucide-react"

import { LessonMarkdown } from "@/features/lessons/components/lesson-markdown"
import type { LessonBlock } from "@/features/lessons/parse-lesson-blocks"
import { Button, cn } from "@beyond/design-system"

type McqUiState = {
  selected: number | null
  submitted: boolean
}

type Props = {
  blocks: LessonBlock[]
  lessonId: string
  className?: string
}

function McqCard({
  block,
  active,
  state,
  onSelect,
  onSubmit,
  onContinue,
  isLastBlock,
  name,
}: {
  block: Extract<LessonBlock, { type: "mcq" }>
  active: boolean
  state: McqUiState
  onSelect: (i: number) => void
  onSubmit: () => void
  onContinue: () => void
  isLastBlock: boolean
  name: string
}) {
  const correct = state.submitted && state.selected === block.correctIndex
  const wrong = state.submitted && state.selected != null && state.selected !== block.correctIndex

  return (
    <article
      className={cn(
        "rounded-xl border border-border/80 bg-card/40 px-4 py-4",
        !active && "opacity-95",
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
          {block.title?.trim() || "Question"}
        </h2>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Help"
          disabled
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      </header>

      <div className="mb-4 text-sm leading-relaxed">
        <LessonMarkdown markdown={block.prompt} />
      </div>

      <ul className="mb-4 space-y-2">
        {block.options.map((opt, i) => {
          const id = `${name}-opt-${i}`
          const disabled = state.submitted || !active
          return (
            <li key={i} className="flex gap-2">
              <input
                type="radio"
                id={id}
                name={name}
                checked={state.selected === i}
                disabled={disabled}
                onChange={() => onSelect(i)}
                className="mt-1.5 size-4 shrink-0 accent-foreground"
              />
              <label
                htmlFor={id}
                className={cn(
                  "min-w-0 flex-1 cursor-pointer text-sm leading-relaxed",
                  disabled && "cursor-default",
                )}
              >
                <span className="mr-2 font-medium tabular-nums text-muted-foreground">{i + 1}.</span>
                <LessonMarkdown markdown={opt} className="inline [&_p]:mb-0 [&_p]:inline" />
              </label>
            </li>
          )
        })}
      </ul>

      {active && !state.submitted ? (
        <Button
          type="button"
          size="sm"
          disabled={state.selected == null}
          onClick={onSubmit}
        >
          Submit
        </Button>
      ) : null}

      {state.submitted ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <p
            className={cn(
              "text-sm font-medium",
              correct && "text-emerald-700 dark:text-emerald-400",
              wrong && "text-destructive",
            )}
          >
            {correct ? "Correct." : wrong ? "Incorrect." : null}
          </p>
          <div className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Explain: </span>
            <LessonMarkdown markdown={block.explanation} className="inline [&_p]:mb-0 [&_p]:inline" />
          </div>
          {active ? (
            <Button type="button" size="sm" variant="secondary" onClick={onContinue}>
              {isLastBlock ? "Finish" : "Continue"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function ContentCard({
  block,
  active,
  onNext,
  showNext,
}: {
  block: Extract<LessonBlock, { type: "content" }>
  active: boolean
  onNext: () => void
  showNext: boolean
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border/80 bg-card/40 px-4 py-4",
        !active && "opacity-95",
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        {block.title?.trim() ? (
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            {block.title}
          </h2>
        ) : (
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            Lesson
          </h2>
        )}
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Help"
          disabled
        >
          <CircleHelp className="size-4" aria-hidden />
        </button>
      </header>
      {block.markdown.trim() ? (
        <LessonMarkdown markdown={block.markdown} />
      ) : null}
      {active && showNext ? (
        <div className="mt-4">
          <Button type="button" size="sm" onClick={onNext}>
            Next
          </Button>
        </div>
      ) : null}
    </article>
  )
}

export function LessonBlockRunner({ blocks, lessonId, className }: Props) {
  const [revealed, setRevealed] = useState(1)
  const [mcqMap, setMcqMap] = useState<Record<number, McqUiState>>({})

  const total = blocks.length
  const activeIndex = revealed - 1

  const setMcq = useCallback((blockIndex: number, patch: Partial<McqUiState>) => {
    setMcqMap((prev) => {
      const base: McqUiState = prev[blockIndex] ?? { selected: null, submitted: false }
      return {
        ...prev,
        [blockIndex]: { ...base, ...patch },
      }
    })
  }, [])

  const advance = useCallback(() => {
    setRevealed((r) => Math.min(r + 1, total))
  }, [total])

  const getMcqState = useCallback(
    (blockIndex: number): McqUiState => {
      return mcqMap[blockIndex] ?? { selected: null, submitted: false }
    },
    [mcqMap],
  )

  if (total === 0) return null

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-5">
        {blocks.map((block, index) => {
          if (index >= revealed) return null

          const active = index === activeIndex

          if (block.type === "content") {
            const showNext = active && index < total - 1
            return (
              <ContentCard
                key={`c-${index}`}
                block={block}
                active={active}
                showNext={showNext}
                onNext={advance}
              />
            )
          }

          const st = getMcqState(index)
          return (
            <McqCard
              key={`m-${index}`}
              block={block}
              active={active}
              state={st}
              name={`mcq-${lessonId}-${index}`}
              isLastBlock={index === total - 1}
              onSelect={(i) => active && setMcq(index, { selected: i })}
              onSubmit={() => {
                if (st.selected == null) return
                setMcq(index, { submitted: true })
              }}
              onContinue={() => {
                advance()
              }}
            />
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Block {Math.min(revealed, total)} of {total}
        {revealed >= total && blocks[total - 1]?.type === "content" ? " · End of lesson" : null}
        {revealed >= total &&
        blocks[total - 1]?.type === "mcq" &&
        getMcqState(total - 1).submitted ? (
          <span> · End of lesson</span>
        ) : null}
      </p>
    </div>
  )
}
