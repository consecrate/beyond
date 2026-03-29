"use client"

import { useEffect } from "react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"
import { Loader2 } from "lucide-react"
import { useParams, useRouter } from "next/navigation"

import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import { getLessonPayload } from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"

type Props = {
  edit: boolean
}

export function LegacyLessonRedirect({ edit }: Props) {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.lessonId as string
  const me = useAccount(FirstlyAccount, {
    resolve: firstlyAccountResolve,
  })

  useEffect(() => {
    if (!me.$isLoaded) return
    assertLoaded(me)
    const lesson = getLessonPayload(me, lessonId)
    if (!lesson) {
      router.replace("/sessions")
      return
    }
    const path = edit
      ? `/sessions/${lesson.session_id}/lessons/${lessonId}/edit`
      : `/sessions/${lesson.session_id}/lessons/${lessonId}`
    router.replace(path)
  }, [me, lessonId, edit, router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  )
}
