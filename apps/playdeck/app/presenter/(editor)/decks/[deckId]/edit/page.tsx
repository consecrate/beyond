import { redirect } from "next/navigation"

import { RevealDeckEditor } from "@/features/decks/components/reveal-deck-editor"
import { getDeckWithSlides } from "@/features/decks/queries"

type RouteProps = {
  params: Promise<{ deckId: string }>
}

export async function generateMetadata({ params }: RouteProps) {
  const { deckId } = await params
  try {
    const { deck } = await getDeckWithSlides(deckId)
    return { title: `Edit — ${deck.title} — PlayDeck` }
  } catch {
    return { title: "Edit deck — PlayDeck" }
  }
}

export default async function DeckEditPage({ params }: RouteProps) {
  const { deckId } = await params

  const result = await getDeckWithSlides(deckId).catch(() => null)
  if (!result) redirect("/presenter/decks")

  const { deck, slides } = result
  const slidesStructureKey =
    slides.length > 0 ? slides.map((s) => s.id).join(",") : "empty"

  return (
    <RevealDeckEditor
      key={`${deckId}-${slidesStructureKey}`}
      deckId={deckId}
      deckTitle={deck.title}
      slides={slides}
    />
  )
}
