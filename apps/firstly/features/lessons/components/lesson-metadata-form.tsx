"use client"

import { useActionState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { updateLesson, type LessonActionState } from "@/features/lessons/actions"
import { Button, Input, Textarea } from "@beyond/design-system"

type Props = {
  lesson: {
    id: string
    session_id: string
    title: string | null
    goal_text: string | null
    lesson_markdown: string | null
  }
  appearance?: "page" | "dialog"
  onSaved?: () => void
}

const initialState: LessonActionState = {}

export function LessonMetadataForm({
  lesson,
  appearance = "page",
  onSaved,
}: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateLesson, initialState)
  const wasPending = useRef(false)

  useEffect(() => {
    if (pending) {
      wasPending.current = true
      return
    }
    if (!wasPending.current) return
    wasPending.current = false
    if (!state.error) {
      router.refresh()
      onSaved?.()
    }
  }, [pending, state.error, onSaved, router])

  const isDialog = appearance === "dialog"

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lessonId" value={lesson.id} />
      <input type="hidden" name="sessionId" value={lesson.session_id} />

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonTitle" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="lessonTitle"
          name="title"
          defaultValue={lesson.title ?? ""}
          placeholder="Untitled lesson"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonGoal" className="text-sm font-medium">
          Goal{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="lessonGoal"
          name="goalText"
          defaultValue={lesson.goal_text ?? ""}
          rows={isDialog ? 2 : 3}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonMarkdown" className="text-sm font-medium">
          Lesson Markdown{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="lessonMarkdown"
          name="lessonMarkdown"
          defaultValue={lesson.lesson_markdown ?? ""}
          rows={isDialog ? 10 : 8}
          className={
            isDialog
              ? "field-sizing-fixed max-h-[min(50vh,20rem)] min-h-[200px] resize-y overflow-y-auto font-mono text-xs leading-relaxed"
              : "field-sizing-fixed max-h-[min(60vh,24rem)] min-h-48 resize-y overflow-y-auto font-mono text-xs leading-relaxed"
          }
          placeholder="Paste or edit the Markdown lesson from your custom GPT ($...$ and $$...$$ for math)."
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to clear stored lesson content.
        </p>
      </div>

      <Button
        type="submit"
        disabled={pending}
        {...(isDialog
          ? {}
          : { size: "sm" as const, className: "self-end" })}
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
