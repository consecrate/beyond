"use client"

import { Suspense, useMemo } from "react"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { coValueId, deckToListItem } from "@/features/decks/deck-map"
import { CreateDeckDialog } from "@/features/decks/components/create-deck-dialog"
import { DeckCard } from "@/features/decks/components/deck-card"
import {
  PresenterAccountMenu,
  PresenterDeckSearch,
} from "@/features/presenter-shell"
import { cn } from "@beyond/design-system"

type Props = {
  searchQuery: string
}

export function DecksPageClient({ searchQuery }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: {
      profile: true,
      root: {
        decks: { $each: { slides: { $each: true } } },
      },
    },
  })

  const decks = useMemo(() => {
    if (!me.$isLoaded) return []
    assertLoaded(me.root)
    const decksList = me.root.decks
    assertLoaded(decksList)
    const items = [...decksList].map((d) => {
      assertLoaded(d)
      return deckToListItem(d)
    })
    items.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    return items
  }, [me])

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return decks
    return decks.filter((d) => d.title.toLowerCase().includes(needle))
  }, [decks, searchQuery])

  const previews = useMemo(() => {
    const map = new Map<string, string>()
    if (!me.$isLoaded) return map
    assertLoaded(me.root)
    const decksList = me.root.decks
    assertLoaded(decksList)
    for (const row of filtered) {
      const jd = [...decksList].find((x) => {
        assertLoaded(x)
        return coValueId(x) === row.id
      })
      if (!jd) continue
      assertLoaded(jd)
      const slides = jd.slides
      assertLoaded(slides)
      const first = slides[0]
      if (first) {
        assertLoaded(first)
        const t = first.title?.trim()
        if (t) map.set(row.id, t)
      }
    }
    return map
  }, [me, filtered])

  if (!me.$isLoaded) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
        <p className="text-sm text-muted-foreground">Loading decks…</p>
      </div>
    )
  }

  const displayName = me.profile?.name?.trim() || "Presenter"

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className={cn(
            "font-display flex h-9 items-center text-2xl font-medium leading-9 tracking-[-0.02em] text-foreground sm:text-3xl",
          )}
        >
          Decks
        </h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Suspense
            fallback={
              <div
                className="h-9 w-full max-w-md rounded-sm border border-border bg-muted/30"
                aria-hidden
              />
            }
          >
            <PresenterDeckSearch />
          </Suspense>
          <PresenterAccountMenu displayName={displayName} />
        </div>
      </div>

      {decks.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          No decks match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreateDeckDialog variant="tile" />
          {filtered.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              firstSlideTitle={previews.get(deck.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
