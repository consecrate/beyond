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
  state,
  onSelect,
  onSubmit,
  name,
}: {
  block: Extract<LessonBlock, { type: "mcq" }>
  state: McqUiState
  onSelect: (i: number) => void
  onSubmit: () => void
  name: string
}) {
  const correct = state.submitted && state.selected === block.correctIndex
  const wrong = state.submitted && state.selected != null && state.selected !== block.correctIndex

  return (
    <article className="rounded-xl border border-border/80 bg-card/40 px-4 py-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
          <LessonMarkdown
            markdown={block.title?.trim() || "Question"}
            variant="inline"
          />
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
          const disabled = state.submitted
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

      {!state.submitted ? (
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
        </div>
      ) : null}
    </article>
  )
}

function ContentCard({ block }: { block: Extract<LessonBlock, { type: "content" }> }) {
  return (
    <article className="rounded-xl border border-border/80 bg-card/40 px-4 py-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        {block.title?.trim() ? (
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
            <LessonMarkdown markdown={block.title} variant="inline" />
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
    </article>
  )
}

export function LessonBlockRunner({
  blocks,
  lessonId,
  className,
}: Props) {
  const [mcqMap, setMcqMap] = useState<Record<number, McqUiState>>({})

  const total = blocks.length

  const setMcq = useCallback((blockIndex: number, patch: Partial<McqUiState>) => {
    setMcqMap((prev) => {
      const base: McqUiState = prev[blockIndex] ?? { selected: null, submitted: false }
      return {
        ...prev,
        [blockIndex]: { ...base, ...patch },
      }
    })
  }, [])

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
          if (block.type === "content") {
            return <ContentCard key={`c-${index}`} block={block} />
          }

          const st = getMcqState(index)
          return (
            <McqCard
              key={`m-${index}`}
              block={block}
              state={st}
              name={`mcq-${lessonId}-${index}`}
              onSelect={(i) => {
                if (st.submitted) return
                setMcq(index, { selected: i })
              }}
              onSubmit={() => {
                if (st.selected == null) return
                setMcq(index, { submitted: true })
              }}
            />
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {total} {total === 1 ? "section" : "sections"}
      </p>
    </div>
  )
}
