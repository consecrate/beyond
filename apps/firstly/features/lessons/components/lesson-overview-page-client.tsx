"use client"

import { useEffect, useMemo } from "react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import {
  getLessonPayload,
  getLessonsForSessionPayload,
  getSessionSkillGraphPayload,
} from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"
import { LessonOverviewContent } from "@/features/lessons/components/lesson-overview-content"

type Props = {
  sessionId: string
  lessonId: string
}

export function LessonOverviewPageClient({ sessionId, lessonId }: Props) {
  const router = useRouter()
  const me = useAccount(FirstlyAccount, {
    resolve: firstlyAccountResolve,
  })

  const lesson = useMemo(() => {
    if (!me.$isLoaded) return null
    assertLoaded(me)
    return getLessonPayload(me, lessonId)
  }, [me, lessonId])

  const sessionLessons = useMemo(() => {
    if (!me.$isLoaded) return []
    assertLoaded(me)
    return getLessonsForSessionPayload(me, sessionId)
  }, [me, sessionId])

  const skillGraph = useMemo(() => {
    if (!me.$isLoaded) return null
    assertLoaded(me)
    return getSessionSkillGraphPayload(me, sessionId)
  }, [me, sessionId])

  useEffect(() => {
    if (!me.$isLoaded) return
    if (!lesson || lesson.session_id !== sessionId) {
      router.replace("/sessions")
    }
  }, [me.$isLoaded, lesson, sessionId, router])

  useEffect(() => {
    if (!lesson) return
    document.title = `${lesson.title?.trim() || "Lesson"} — Firstly`
  }, [lesson])

  if (!me.$isLoaded || !lesson || lesson.session_id !== sessionId) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    )
  }

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
