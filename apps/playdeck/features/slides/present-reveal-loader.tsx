"use client"

import dynamic from "next/dynamic"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"

const DeckRevealPresenter = dynamic(
  () =>
    import("@/features/slides/deck-reveal-presenter").then(
      (m) => m.DeckRevealPresenter,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      </div>
    ),
  },
)

type PresentRevealLoaderProps = {
  deckTitle: string
  slides: RevealSlideModel[]
  backHref: string
  initialSlideIndex?: number
}

export function PresentRevealLoader(props: PresentRevealLoaderProps) {
  return <DeckRevealPresenter {...props} />
}
