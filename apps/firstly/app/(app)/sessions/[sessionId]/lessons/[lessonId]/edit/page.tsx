import { notFound, redirect } from "next/navigation"

import { getLesson } from "@/features/lessons/queries"

type Props = {
  params: Promise<{ sessionId: string; lessonId: string }>
}

export default async function LessonEditPage({ params }: Props) {
  const { sessionId, lessonId } = await params
  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()
  if (lesson.session_id !== sessionId) notFound()
  redirect(`/sessions/${sessionId}/lessons/${lessonId}`)
}
