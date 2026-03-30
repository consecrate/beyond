"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import type { LessonRow } from "@/features/firstly/data-types"
import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import { updateLessonFields } from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"
import { LessonBlockRunner } from "@/features/lessons/components/lesson-block-runner"
import { EditLessonDialog } from "@/features/lessons/components/edit-lesson-dialog"
import { LessonMarkdown } from "@/features/lessons/components/lesson-markdown"
import { parseLessonMarkdownToBlocks } from "@/features/lessons/parse-lesson-blocks"
import {
  buildLessonGptPrompt,
  type LessonSkillTreePromptInput,
} from "@/features/lessons/lesson-gpt-prompt"
import { Button, Textarea, cn } from "@beyond/design-system"

type Props = {
  lesson: LessonRow
  skillTree: LessonSkillTreePromptInput
  className?: string
}

type MarkdownImportProps = {
  lessonId: string
  sessionId: string
  lessonMarkdown: string | null
}

function LessonSkillTreeCompleteButton({
  lessonId,
  completed,
}: {
  lessonId: string
  completed: boolean
}) {
  const me = useAccount(FirstlyAccount, { resolve: firstlyAccountResolve })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={completed ? "default" : "outline"}
        size="sm"
        disabled={pending || !me.$isLoaded}
        aria-pressed={completed}
        aria-label={completed ? "Marked complete on skill tree" : "Mark complete on skill tree"}
        onClick={() => {
          setError(null)
          startTransition(() => {
            assertLoaded(me)
            const r = updateLessonFields(me, lessonId, {
              skill_tree_completed: !completed,
            })
            if (!r.ok) setError(r.error)
          })
        }}
      >
        {pending ? "Saving…" : completed ? "Completed" : "Mark complete"}
      </Button>
      {error ? (
        <p className="max-w-[12rem] text-right text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

function LessonMarkdownImportSection({
  lessonId,
  sessionId,
  lessonMarkdown,
}: MarkdownImportProps) {
  const me = useAccount(FirstlyAccount, { resolve: firstlyAccountResolve })
  const [draft, setDraft] = useState(() => lessonMarkdown ?? "")
  const [error, setError] = useState<string | null>(null)
  const [savePending, startTransition] = useTransition()

  const savedMarkdownTrimmed = lessonMarkdown?.trim() ?? ""
  const hasSavedMarkdown = savedMarkdownTrimmed.length > 0

  const parsedLesson = useMemo(
    () => (hasSavedMarkdown ? parseLessonMarkdownToBlocks(savedMarkdownTrimmed) : null),
    [hasSavedMarkdown, savedMarkdownTrimmed],
  )

  const draftParsed = useMemo(
    () => (draft.trim() ? parseLessonMarkdownToBlocks(draft) : null),
    [draft],
  )

  return (
    <section className="space-y-4">
      {hasSavedMarkdown ? (
        <div className="space-y-3">
          {parsedLesson && !parsedLesson.ok ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Blocked lesson parse error: {parsedLesson.error} Showing full Markdown below.
            </p>
          ) : null}
          {parsedLesson?.ok && parsedLesson.blocks.length > 0 ? (
            <LessonBlockRunner blocks={parsedLesson.blocks} lessonId={lessonId} />
          ) : (
            <div className="rounded-lg border border-border/80 bg-card/30 px-4 py-4">
              <LessonMarkdown markdown={savedMarkdownTrimmed} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No lesson Markdown saved yet. Paste from your custom GPT below, then click Learn.
        </p>
      )}

      {!hasSavedMarkdown ? (
        <>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Import or edit Markdown
            </h3>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault()
                setError(null)
                startTransition(() => {
                  assertLoaded(me)
                  const r = updateLessonFields(me, lessonId, {
                    lesson_markdown: draft,
                  })
                  if (!r.ok) {
                    setError(r.error)
                  }
                })
              }}
            >
              <input type="hidden" name="lessonId" value={lessonId} />
              <input type="hidden" name="sessionId" value={sessionId} />
              <Textarea
                name="lessonMarkdown"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='Paste Markdown from your GPT, then click "Learn". Use $...$ and $$...$$ for math.'
                rows={14}
                className="min-h-48 resize-y font-mono text-xs leading-relaxed"
                aria-label="Lesson Markdown"
              />
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={savePending || !me.$isLoaded}
                className="self-start"
              >
                {savePending ? "Saving…" : "Learn"}
              </Button>
            </form>
          </div>

          {draft.trim() ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview (draft)
              </h3>
              {draftParsed?.ok && draftParsed.blocks.length > 0 ? (
                <LessonBlockRunner blocks={draftParsed.blocks} lessonId={lessonId} />
              ) : draftParsed && !draftParsed.ok ? (
                <div className="space-y-2">
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Blocked lesson parse error: {draftParsed.error}
                  </p>
                  <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-4">
                    <LessonMarkdown markdown={draft} />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-4">
                  <LessonMarkdown markdown={draft} />
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export function LessonOverviewContent({ lesson, skillTree, className }: Props) {
  const promptText = useMemo(
    () => buildLessonGptPrompt(lesson, skillTree),
    [lesson, skillTree],
  )
  const [copied, setCopied] = useState(false)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cn("w-full min-w-0 space-y-6 pb-1 md:pb-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <h1
          className={cn(
            "min-w-0 flex-1 font-display text-lg font-medium tracking-[-0.02em] text-black sm:text-2xl lg:text-2xl",
          )}
        >
          {lesson.title?.trim() || "Untitled lesson"}
        </h1>
        <div className="flex shrink-0 items-start gap-2">
          <LessonSkillTreeCompleteButton
            lessonId={lesson.id}
            completed={lesson.skill_tree_completed}
          />
          <EditLessonDialog
            lesson={{
              id: lesson.id,
              session_id: lesson.session_id,
              title: lesson.title,
              goal_text: lesson.goal_text,
              lesson_markdown: lesson.lesson_markdown,
            }}
          />
        </div>
      </div>

      {!lesson.lesson_markdown?.trim() ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Custom GPT prompt</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void copyPrompt()}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Textarea
            readOnly
            value={promptText}
            className="min-h-48 resize-y font-mono text-xs leading-relaxed"
            aria-label="Prompt to paste into your custom GPT"
          />
        </section>
      ) : null}

      <LessonMarkdownImportSection
        key={`${lesson.id}-${lesson.updated_at}`}
        lessonId={lesson.id}
        sessionId={lesson.session_id}
        lessonMarkdown={lesson.lesson_markdown}
      />
    </div>
  )
}
