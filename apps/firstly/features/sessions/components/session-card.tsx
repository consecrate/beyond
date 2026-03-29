"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Trash2 } from "lucide-react"

import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import { firstlyAccountResolve } from "@/features/firstly/account-resolve"
import { deleteSessionById } from "@/features/firstly/jazz-firstly-mutations"
import { FirstlyAccount } from "@/features/jazz/schema"
import type { SessionRow } from "@/features/firstly/data-types"
import { Button, cn } from "@beyond/design-system"
import { formatRelativeTimeShort } from "@/lib/format-relative-time"

type Props = {
  session: SessionRow
}

export function SessionCard({ session }: Props) {
  const me = useAccount(FirstlyAccount, { resolve: firstlyAccountResolve })
  const [pending, startTransition] = useTransition()
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

      <div
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          disabled={pending || !me.$isLoaded}
          className="size-8 border border-border/80 bg-card/95 backdrop-blur-sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!confirm("Delete this session and all lessons in it?")) return
            startTransition(() => {
              assertLoaded(me)
              const r = deleteSessionById(me, session.id)
              if (!r.ok) {
                alert(r.error)
              }
            })
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete session</span>
        </Button>
      </div>
    </article>
  )
}
