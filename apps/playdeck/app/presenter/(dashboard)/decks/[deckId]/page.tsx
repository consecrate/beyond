import { DeckDetailClient } from "@/features/decks/components/deck-detail-client"

type RouteProps = {
  params: Promise<{ deckId: string }>
}

export async function generateMetadata() {
  return { title: "Deck — PlayDeck" }
}

export default async function DeckDetailPage({ params }: RouteProps) {
  const { deckId } = await params
  return <DeckDetailClient deckId={deckId} />
}
