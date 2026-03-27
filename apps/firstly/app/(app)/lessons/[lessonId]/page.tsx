import Link from "next/link"
import { notFound } from "next/navigation"

import { getLesson } from "@/features/lessons/queries"
import { Button, cn } from "@beyond/design-system"

type Props = {
  params: Promise<{ lessonId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLesson(lessonId)
  const title = lesson?.title?.trim() || "Lesson"
  return { title: `${title} — Firstly` }
}

export default async function LessonOverviewPage({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1
          className={cn(
            "min-w-0 font-display text-2xl font-medium tracking-[-0.02em] text-foreground sm:text-3xl"
          )}
        >
          {lesson.title?.trim() || "Untitled lesson"}
        </h1>
        <Button
          className="shrink-0"
          nativeButton={false}
          render={<Link href={`/lessons/${lessonId}/edit`} />}
        >
          Edit details
        </Button>
      </div>

      <p className="rounded-sm border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Skill graph, document ingestion, and practice will surface here as those product
        slices ship.
      </p>
    </div>
  )
}
