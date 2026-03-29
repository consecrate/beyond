"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Trash2 } from "lucide-react"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { deleteDeckById } from "@/features/decks/jazz-deck-mutations"
import { Button, cn } from "@beyond/design-system"
import { formatRelativeTimeShort } from "@/lib/format-relative-time"

type Props = {
  deck: {
    id: string
    title: string
    updated_at: string
  }
  firstSlideTitle?: string
}

export function DeckCard({ deck, firstSlideTitle }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: { root: { decks: true } },
  })
  const [pending, startTransition] = useTransition()
  const when = formatRelativeTimeShort(deck.updated_at)
  const href = `/presenter/decks/${deck.id}`

  function onDelete() {
    if (!me.$isLoaded) return
    assertLoaded(me.root)
    startTransition(() => {
      const r = deleteDeckById(me, deck.id)
      if (!r.ok) {
        alert(r.error)
      }
    })
  }

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
          {firstSlideTitle ? (
            <p className="absolute inset-x-4 bottom-4 top-auto line-clamp-2 text-center text-xs font-medium text-muted-foreground">
              {firstSlideTitle}
            </p>
          ) : null}
        </div>
        <div className="space-y-0.5 p-3 pt-2">
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
            {deck.title || "Untitled"}
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
          disabled={pending}
          className="size-8 border border-border/80 bg-card/95 backdrop-blur-sm"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!confirm("Delete this deck?")) return
            onDelete()
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          <span className="sr-only">Delete deck</span>
        </Button>
      </div>
    </article>
  )
}
