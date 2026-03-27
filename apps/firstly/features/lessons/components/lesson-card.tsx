"use client"

import Link from "next/link"
import { Trash2 } from "lucide-react"

import { deleteLesson } from "@/features/lessons/actions"
import { Button, cn } from "@beyond/design-system"
import { formatRelativeTimeShort } from "@/lib/format-relative-time"

type Props = {
  lesson: {
    id: string
    title: string | null
    goal_text: string | null
    entry_mode: string
    updated_at: string
  }
}

export function LessonCard({ lesson }: Props) {
  const when = formatRelativeTimeShort(lesson.updated_at)
  const href = `/lessons/${lesson.id}`

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-sm border border-border bg-card transition-colors",
        "hover:border-border",
      )}
    >
      <Link
        href={href}
        className="block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-4/3 bg-muted">
          <div className="absolute inset-2 rounded-sm border border-border/50 bg-background/90" />
          <p className="absolute inset-x-4 bottom-4 top-auto line-clamp-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {lesson.entry_mode.replace("_", " ")}
          </p>
        </div>
        <div className="space-y-0.5 p-3 pt-2">
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
            {lesson.title?.trim() || "Untitled lesson"}
          </h3>
          {lesson.goal_text ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{lesson.goal_text}</p>
          ) : null}
          {when ? (
            <p className="text-xs text-muted-foreground tabular-nums">{when}</p>
          ) : null}
        </div>
      </Link>

      <form
        action={deleteLesson}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <input type="hidden" name="lessonId" value={lesson.id} />
        <Button
          type="submit"
          variant="secondary"
          size="icon-sm"
          className="size-8 border border-border/80 bg-card/95 backdrop-blur-sm"
          onClick={(e) => {
            if (!confirm("Delete this lesson and all related data?")) {
              e.preventDefault()
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete lesson</span>
        </Button>
      </form>
    </article>
  )
}
