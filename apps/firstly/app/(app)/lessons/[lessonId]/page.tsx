import { notFound, redirect } from "next/navigation"

import { getLesson } from "@/features/lessons/queries"

type Props = {
  params: Promise<{ lessonId: string }>
}

export default async function LegacyLessonPageRedirect({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()
  redirect(`/sessions/${lesson.session_id}/lessons/${lessonId}`)
}
