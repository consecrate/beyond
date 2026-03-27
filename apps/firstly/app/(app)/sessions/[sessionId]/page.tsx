import { notFound } from "next/navigation"

import { CreateSessionDialog } from "@/features/lessons/components/create-session-dialog"
import { getLessonsForSession } from "@/features/lessons/queries"
import { SessionAiChat } from "@/features/sessions/components/session-ai-chat"
import { SessionSkillTree } from "@/features/sessions/components/session-skill-tree"
import { SessionSplitPanels } from "@/features/sessions/components/session-split-panels"
import { getSession, getSessionSkillGraph } from "@/features/sessions/queries"
import { cn } from "@beyond/design-system"

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
        <div className="flex flex-col gap-3 px-5 py-0 md:px-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1
              className={cn(
                "font-display flex h-9 items-center text-xl font-medium leading-none tracking-[-0.02em] text-foreground",
              )}
            >
              {session.title?.trim() || "Untitled session"}
            </h1>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:max-w-none sm:flex-initial">
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
        <SessionSplitPanels
          left={<SessionAiChat sessionId={sessionId} />}
          right={
            <SessionSkillTree
              sessionId={sessionId}
              lessons={lessons}
              skillGraph={skillGraph}
            />
          }
        />
      </div>
    </div>
  )
}
