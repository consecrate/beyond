import { LessonOverviewPageClient } from "@/features/lessons/components/lesson-overview-page-client"

type Props = {
  params: Promise<{ sessionId: string; lessonId: string }>
}

export default async function LessonOverviewPage({ params }: Props) {
  const { sessionId, lessonId } = await params

  return (
    <LessonOverviewPageClient sessionId={sessionId} lessonId={lessonId} />
  )
}
