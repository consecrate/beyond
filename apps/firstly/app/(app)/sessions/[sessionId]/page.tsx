import { notFound } from "next/navigation"

import { CreateSessionDialog } from "@/features/lessons/components/create-session-dialog"
import { getLessonsForSession } from "@/features/lessons/queries"
import { SessionPageBackButton } from "@/features/sessions/components/session-page-back-button"
import { SessionSkillTreeImportDialog } from "@/features/sessions/components/session-skill-tree-import-dialog"
import { SessionWorkspace } from "@/features/sessions/components/session-workspace"
import { getSession, getSessionSkillGraph } from "@/features/sessions/queries"

type Props = {
  params: Promise<{ sessionId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { sessionId } = await params
  const session = await getSession(sessionId)
  const title = session?.title?.trim() || "Session"
  return { title: `${title} — Firstly` }
}

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params
  const [session, lessons, skillGraph] = await Promise.all([
    getSession(sessionId),
    getLessonsForSession(sessionId),
    getSessionSkillGraph(sessionId),
  ])
  if (!session) notFound()

  const rootLesson =
    [...lessons].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ??
    null

  return (
    <div className="flex h-svh flex-col overflow-hidden -mx-5 md:-mx-8">
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
                title: session.title?.trim() ?? "",
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
