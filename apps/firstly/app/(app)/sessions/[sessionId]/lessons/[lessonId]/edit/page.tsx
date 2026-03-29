import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ sessionId: string; lessonId: string }>
}

export default async function LessonEditPage({ params }: Props) {
  const { sessionId, lessonId } = await params
  redirect(`/sessions/${sessionId}/lessons/${lessonId}`)
}
