import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"

import type { DeckListItemView, DeckSlideView } from "@/features/decks/deck-types"
import { Deck } from "@/features/jazz/schema"

export function coValueId(v: { $jazz: { readonly id: string } }): string {
  return v.$jazz.id
}

export function deckToListItem(deck: Loaded<typeof Deck>): DeckListItemView {
  return {
    id: coValueId(deck),
    title: deck.title,
    updated_at: deck.updatedAt,
  }
}

export function deckSlidesToViews(deck: Loaded<typeof Deck>): DeckSlideView[] {
  const slides = deck.slides
  assertLoaded(slides)
  return [...slides].map((s) => {
    assertLoaded(s)
    return {
      id: coValueId(s),
      title: s.title,
      body: s.body,
      updated_at: deck.updatedAt,
    }
  })
}
