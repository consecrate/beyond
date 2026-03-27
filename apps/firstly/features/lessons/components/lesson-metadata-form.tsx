"use client"

import { useActionState } from "react"

import { updateLesson, type LessonActionState } from "@/features/lessons/actions"
import { Button, Input, Textarea } from "@beyond/design-system"

type Props = {
  lesson: {
    id: string
    title: string | null
    goal_text: string | null
  }
}

const initialState: LessonActionState = {}

export function LessonMetadataForm({ lesson }: Props) {
  const [state, action, pending] = useActionState(updateLesson, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lessonId" value={lesson.id} />

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
          rows={3}
        />
      </div>

      <Button type="submit" size="sm" disabled={pending} className="self-end">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
