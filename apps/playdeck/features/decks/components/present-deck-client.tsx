"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { findDeck } from "@/features/decks/jazz-deck-mutations"
import { deckSlidesToViews } from "@/features/decks/deck-map"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import { PresentRevealLoader } from "@/features/slides/present-reveal-loader"

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

type Props = {
  deckId: string
  initialSlideIndex: number
}

export function PresentDeckClient({ deckId, initialSlideIndex }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: {
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
  const slidesForPresentation = slides.map((s) => ({
    title: s.title,
    html: slideMarkdownToSafeHtml(s.body),
  }))

  return (
    <PresentRevealLoader
      deckTitle={deck.title}
      slides={slidesForPresentation}
      backHref={`/presenter/decks/${deckId}`}
      initialSlideIndex={initialSlideIndex}
    />
  )
}
