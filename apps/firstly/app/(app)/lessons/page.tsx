import { Suspense } from "react"

import { CreateLessonDialog } from "@/features/lessons/components/create-lesson-dialog"
import { LessonCard } from "@/features/lessons/components/lesson-card"
import { getLessonsForUser } from "@/features/lessons/queries"
import { AppUserMenuLoader, LessonSearch } from "@/features/shell"
import { cn } from "@beyond/design-system"

export const metadata = {
  title: "Lessons — Firstly",
  description: "Your lesson workspaces and progress.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

function LessonSearchFallback() {
  return (
    <div
      className="h-9 w-full max-w-md rounded-sm border border-border bg-muted/30"
      aria-hidden
    />
  )
}

export default async function LessonsPage(props: Props) {
  const { q } = await props.searchParams

  const lessons = await getLessonsForUser()
  const needle = q?.trim().toLowerCase()
  const filtered = needle
    ? lessons.filter((l) => {
        const t = (l.title ?? "").toLowerCase()
        const g = (l.goal_text ?? "").toLowerCase()
        return t.includes(needle) || g.includes(needle)
      })
    : lessons

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className={cn(
            "font-display flex h-9 items-center text-2xl font-medium leading-9 tracking-[-0.02em] text-foreground sm:text-3xl"
          )}
        >
          Lessons
        </h1>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:max-w-none sm:flex-initial">
          <Suspense fallback={<LessonSearchFallback />}>
            <LessonSearch defaultQuery={q ?? ""} />
          </Suspense>
          <Suspense fallback={null}>
            <AppUserMenuLoader />
          </Suspense>
        </div>
      </div>

      {lessons.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          No lessons match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreateLessonDialog variant="tile" />
          {filtered.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  )
}
