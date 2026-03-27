"use client"

import Link from "next/link"
import { Trash2 } from "lucide-react"

import { deleteSession } from "@/features/lessons/actions"
import type { SessionRow } from "@/features/sessions/queries"
import { Button, cn } from "@beyond/design-system"
import { formatRelativeTimeShort } from "@/lib/format-relative-time"

type Props = {
  session: SessionRow
}

export function SessionCard({ session }: Props) {
  const when = formatRelativeTimeShort(session.updated_at)
  const href = `/sessions/${session.id}`

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-sm border border-border bg-card transition-colors",
        "hover:border-border",
      )}
    >
      <Link
        href={href}
        className="block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-4/3 bg-muted">
          <div className="absolute inset-2 rounded-sm border border-border/50 bg-background/90" />
        </div>
        <div className="space-y-0.5 p-3 pt-2">
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
            {session.title?.trim() || "Untitled session"}
          </h3>
          {when ? (
            <p className="text-xs text-muted-foreground tabular-nums">{when}</p>
          ) : null}
        </div>
      </Link>

      <form
        action={deleteSession}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <input type="hidden" name="sessionId" value={session.id} />
        <Button
          type="submit"
          variant="secondary"
          size="icon-sm"
          className="size-8 border border-border/80 bg-card/95 backdrop-blur-sm"
          onClick={(e) => {
            if (!confirm("Delete this session and all lessons in it?")) {
              e.preventDefault()
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete session</span>
        </Button>
      </form>
    </article>
  )
}
