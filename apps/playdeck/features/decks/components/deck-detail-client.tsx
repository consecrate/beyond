"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { findDeck } from "@/features/decks/jazz-deck-mutations"
import { deckSlidesToViews } from "@/features/decks/deck-map"
import { DeckMarkdownWorkspace } from "@/features/decks/components/deck-markdown-workspace"

function RedirectToDecks() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/presenter/decks")
  }, [router])
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Redirecting…
    </div>
  )
}

export function DeckDetailClient({ deckId }: { deckId: string }) {
  const me = useAccount(PlaydeckAccount, {
    resolve: {
      profile: true,
      root: {
        decks: { $each: { slides: { $each: true } } },
      },
    },
  })

  if (!me.$isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  assertLoaded(me.root)
  const deck = findDeck(me.root, deckId)
  if (!deck) {
    return <RedirectToDecks />
  }

  const slides = deckSlidesToViews(deck)
  const displayName = me.profile?.name?.trim() || "Presenter"

  return (
    <DeckMarkdownWorkspace
      deckId={deckId}
      initialTitle={deck.title}
      slides={slides}
      displayName={displayName}
    />
  )
}
