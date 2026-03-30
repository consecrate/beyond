"use client"

import { useRef, useState, useTransition, type FormEvent } from "react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import { updateLessonFields } from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"
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

export function LessonMetadataForm({
  lesson,
  appearance = "page",
  onSaved,
}: Props) {
  const me = useAccount(FirstlyAccount, { resolve: firstlyAccountResolve })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const lessonMarkdownRef = useRef<HTMLTextAreaElement>(null)

  const isDialog = appearance === "dialog"

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const fd = new FormData(e.currentTarget)
        startTransition(() => {
          assertLoaded(me)
          const title = (fd.get("title") as string)?.trim() || null
          const goalRaw = (fd.get("goalText") as string)?.trim()
          const goal_text = goalRaw ? goalRaw : null
          const lessonMarkdownRaw = fd.get("lessonMarkdown")
          const r = updateLessonFields(me, lesson.id, {
            title,
            goal_text,
            lesson_markdown:
              lessonMarkdownRaw !== null && typeof lessonMarkdownRaw === "string"
                ? lessonMarkdownRaw
                : undefined,
          })
          if (!r.ok) {
            setError(r.error)
            return
          }
          onSaved?.()
        })
      }}
    >
      <input type="hidden" name="lessonId" value={lesson.id} />
      <input type="hidden" name="sessionId" value={lesson.session_id} />

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
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
          ref={lessonMarkdownRef}
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
        disabled={pending || !me.$isLoaded}
        {...(isDialog
          ? {}
          : { size: "sm" as const, className: "self-end" })}
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
