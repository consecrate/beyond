import { notFound } from "next/navigation"

import { LessonOverviewContent } from "@/features/lessons/components/lesson-overview-content"
import { getLesson, getLessonsForSession } from "@/features/lessons/queries"
import { getSessionSkillGraph } from "@/features/sessions/queries"

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

  const [sessionLessons, skillGraph] = await Promise.all([
    getLessonsForSession(sessionId),
    getSessionSkillGraph(sessionId),
  ])

  return (
    <LessonOverviewContent
      lesson={lesson}
      skillTree={{
        currentLessonId: lessonId,
        sessionLessons,
        edges: skillGraph?.edges ?? [],
      }}
    />
  )
}
