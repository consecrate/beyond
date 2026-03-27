import { Suspense } from "react"

import { CreateSessionDialog } from "@/features/lessons/components/create-session-dialog"
import { SessionCard } from "@/features/sessions/components/session-card"
import {
  getSessionsWithLessonsForUser,
  type SessionWithLessons,
} from "@/features/sessions/queries"
import { AppUserMenuLoader, SessionSearch } from "@/features/shell"
import { cn } from "@beyond/design-system"

export const metadata = {
  title: "Sessions — Firstly",
  description: "Your session workspaces and lessons.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

function SessionSearchFallback() {
  return (
    <div
      className="h-9 w-full max-w-md rounded-sm border border-border bg-muted/30"
      aria-hidden
    />
  )
}

function matchesQuery(s: SessionWithLessons, needle: string): boolean {
  if (!needle) return true
  const n = needle.toLowerCase()
  if ((s.title ?? "").toLowerCase().includes(n)) return true
  const lessons = s.lessons ?? []
  return lessons.some((l) => {
    const t = (l.title ?? "").toLowerCase()
    const g = (l.goal_text ?? "").toLowerCase()
    return t.includes(n) || g.includes(n)
  })
}

export default async function SessionsPage(props: Props) {
  const { q } = await props.searchParams

  const sessions = await getSessionsWithLessonsForUser()
  const needle = q?.trim().toLowerCase() ?? ""
  const filtered = needle ? sessions.filter((s) => matchesQuery(s, needle)) : sessions

  return (
    <div className="mx-auto max-w-6xl pb-1 md:pb-2">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className={cn(
            "font-display flex h-9 items-center text-2xl font-medium leading-9 tracking-[-0.02em] text-foreground sm:text-3xl",
          )}
        >
          Sessions
        </h1>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:max-w-none sm:flex-initial">
          <Suspense fallback={<SessionSearchFallback />}>
            <SessionSearch defaultQuery={q ?? ""} />
          </Suspense>
          <Suspense fallback={null}>
            <AppUserMenuLoader />
          </Suspense>
        </div>
      </div>

      {sessions.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          No sessions or lessons match &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreateSessionDialog variant="tile" />
          {filtered.map((row) => (
            <SessionCard key={row.id} session={row} />
          ))}
        </div>
      )}
    </div>
  )
}
