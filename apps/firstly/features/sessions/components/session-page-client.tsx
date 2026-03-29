"use client"

import { useEffect, useMemo } from "react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import {
  getLessonsForSessionPayload,
  getSessionSkillGraphPayload,
  getSessionRow,
} from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"
import { CreateSessionDialog } from "@/features/lessons/components/create-session-dialog"
import { SessionPageBackButton } from "@/features/sessions/components/session-page-back-button"
import { SessionSkillTreeImportDialog } from "@/features/sessions/components/session-skill-tree-import-dialog"
import { SessionWorkspace } from "@/features/sessions/components/session-workspace"

type Props = {
  sessionId: string
}

export function SessionPageClient({ sessionId }: Props) {
  const router = useRouter()
  const me = useAccount(FirstlyAccount, {
    resolve: firstlyAccountResolve,
  })

  const sessionRow = useMemo(() => {
    if (!me.$isLoaded) return null
    assertLoaded(me)
    return getSessionRow(me, sessionId)
  }, [me, sessionId])

  const lessons = useMemo(() => {
    if (!me.$isLoaded) return []
    assertLoaded(me)
    return getLessonsForSessionPayload(me, sessionId)
  }, [me, sessionId])

  const skillGraph = useMemo(() => {
    if (!me.$isLoaded) return null
    assertLoaded(me)
    return getSessionSkillGraphPayload(me, sessionId)
  }, [me, sessionId])

  const rootLesson = useMemo(() => {
    const sorted = [...lessons].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )
    return sorted[0] ?? null
  }, [lessons])

  useEffect(() => {
    if (!me.$isLoaded) return
    if (sessionRow === null) {
      router.replace("/sessions")
    }
  }, [me.$isLoaded, sessionRow, router])

  if (!me.$isLoaded || sessionRow === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden -mx-5 md:-mx-8">
      <SessionDocumentTitle title={sessionRow.title?.trim() || "Session"} />
      <div className="relative left-1/2 w-screen max-w-[100vw] shrink-0 -translate-x-1/2 border-b border-border">
        <div className="flex flex-col gap-3 sm:flex-row px-2 sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center">
            <SessionPageBackButton />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-none sm:flex-initial sm:gap-3">
            <SessionSkillTreeImportDialog sessionId={sessionId} />
            <CreateSessionDialog
              edit={{
                sessionId,
                title: sessionRow.title?.trim() ?? "",
                rootLesson: rootLesson
                  ? { goalText: rootLesson.goal_text ?? null }
                  : undefined,
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative left-1/2 flex min-h-0 w-screen max-w-[100vw] flex-1 -translate-x-1/2 flex-col overflow-hidden">
        <SessionWorkspace lessons={lessons} skillGraph={skillGraph} />
      </div>
    </div>
  )
}

function SessionDocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} — Firstly`
  }, [title])
  return null
}
