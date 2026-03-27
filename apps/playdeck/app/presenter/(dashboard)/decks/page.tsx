import { Suspense } from "react"

import {
  getFirstSlideTitlesByDeckIds,
  getPresenterDecks,
} from "@/features/decks/queries"
import { CreateDeckDialog } from "@/features/decks/components/create-deck-dialog"
import { DeckCard } from "@/features/decks/components/deck-card"
import { PresenterDeckSearch } from "@/features/presenter-shell"
import { cn } from "@beyond/design-system"

export const metadata = {
  title: "Decks — PlayDeck",
  description: "Manage your presentation decks.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

function DeckSearchFallback() {
  return (
    <div
      className="h-9 w-full max-w-md rounded-sm border border-border bg-muted/30"
      aria-hidden
    />
  )
}

export default async function DecksPage(props: Props) {
  const { q } = await props.searchParams

  const decks = await getPresenterDecks()
  const needle = q?.trim().toLowerCase()
  const filtered = needle
    ? decks.filter((d) => d.title.toLowerCase().includes(needle))
    : decks

  const previews = await getFirstSlideTitlesByDeckIds(filtered.map((d) => d.id))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className={cn(
            "font-display flex h-9 items-center text-2xl font-medium leading-9 tracking-[-0.02em] text-foreground sm:text-3xl"
          )}
        >
          Decks
        </h1>
        <Suspense fallback={<DeckSearchFallback />}>
          <PresenterDeckSearch />
        </Suspense>
      </div>

      {decks.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          No decks match &ldquo;{q}&rdquo;.
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
