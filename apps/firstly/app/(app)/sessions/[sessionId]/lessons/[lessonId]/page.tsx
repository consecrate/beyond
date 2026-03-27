import { notFound } from "next/navigation"

import { EditLessonDialog } from "@/features/lessons/components/edit-lesson-dialog"
import { getLesson } from "@/features/lessons/queries"
import { cn } from "@beyond/design-system"

type Props = {
  params: Promise<{ sessionId: string; lessonId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLesson(lessonId)
  const title = lesson?.title?.trim() || "Lesson"
  return { title: `${title} — Firstly` }
}

export default async function LessonOverviewPage({ params }: Props) {
  const { sessionId, lessonId } = await params
  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()
  if (lesson.session_id !== sessionId) notFound()

  return (
    <div className="w-full min-w-0 space-y-6 pb-1 md:pb-2">
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
          }}
        />
      </div>

      <p className="rounded-sm border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Skill graph, document ingestion, and practice will surface here as those product slices
        ship.
      </p>
    </div>
  )
}
