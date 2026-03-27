import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { LessonMetadataForm } from "@/features/lessons/components/lesson-metadata-form"
import { AppUserMenuLoader } from "@/features/shell"
import { getLesson } from "@/features/lessons/queries"
import { Button, cn } from "@beyond/design-system"

type Props = {
  params: Promise<{ lessonId: string }>
}

export default async function LessonEditPage({ params }: Props) {
  const { lessonId } = await params
  const lesson = await getLesson(lessonId)
  if (!lesson) notFound()

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1
          className={cn(
            "font-display text-xl font-medium tracking-[-0.02em] text-foreground sm:text-2xl"
          )}
        >
          Lesson details
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href={`/lessons/${lessonId}`} />}
          >
            Back
          </Button>
          <Suspense fallback={null}>
            <AppUserMenuLoader />
          </Suspense>
        </div>
      </div>

      <LessonMetadataForm lesson={lesson} />
    </div>
  )
}
