"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { saveLessonMarkdown, type LessonActionState } from "@/features/lessons/actions"
import { LessonBlockRunner } from "@/features/lessons/components/lesson-block-runner"
import { EditLessonDialog } from "@/features/lessons/components/edit-lesson-dialog"
import { LessonMarkdown } from "@/features/lessons/components/lesson-markdown"
import { parseLessonMarkdownToBlocks } from "@/features/lessons/parse-lesson-blocks"
import {
  buildLessonGptPrompt,
  type LessonSkillTreePromptInput,
} from "@/features/lessons/lesson-gpt-prompt"
import type { LessonRow } from "@/features/lessons/queries"
import { Button, Textarea, cn } from "@beyond/design-system"

type Props = {
  lesson: LessonRow
  skillTree: LessonSkillTreePromptInput
  className?: string
}

const markdownInitialState: LessonActionState = {}

type MarkdownImportProps = {
  lessonId: string
  sessionId: string
  lessonMarkdown: string | null
}

function LessonMarkdownImportSection({
  lessonId,
  sessionId,
  lessonMarkdown,
}: MarkdownImportProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => lessonMarkdown ?? "")

  const [saveState, saveAction, savePending] = useActionState(
    saveLessonMarkdown,
    markdownInitialState,
  )
  const saveWasPending = useRef(false)

  useEffect(() => {
    if (savePending) {
      saveWasPending.current = true
      return
    }
    if (!saveWasPending.current) return
    saveWasPending.current = false
    if (!saveState.error) router.refresh()
  }, [savePending, saveState.error, router])

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
            <form action={saveAction} className="flex flex-col gap-2">
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
              {saveState.error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveState.error}
                </p>
              )}
              <Button type="submit" disabled={savePending} className="self-start">
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
                <LessonBlockRunner blocks={draftParsed.blocks} lessonId={`${lessonId}-draft`} />
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
      <div className="flex items-center justify-between gap-4">
        <h1
          className={cn(
            "min-w-0 font-display text-lg font-medium tracking-[-0.02em] text-black sm:text-2xl lg:text-2xl",
          )}
        >
          {lesson.title?.trim() || "Untitled lesson"}
        </h1>
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
