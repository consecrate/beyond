import { PresentDeckClient } from "@/features/decks/components/present-deck-client"

type RouteProps = {
  params: Promise<{ deckId: string }>
  searchParams: Promise<{ slide?: string }>
}

export const metadata = {
  title: "Present — PlayDeck",
}

export default async function PresentDeckPage({
  params,
  searchParams,
}: RouteProps) {
  const { deckId } = await params
  const { slide: slideParam } = await searchParams

  let initialSlideIndex = 0
  if (slideParam != null && slideParam !== "") {
    const n = Number.parseInt(slideParam, 10)
    if (Number.isFinite(n) && n >= 1) {
      initialSlideIndex = n - 1
    }
  }

  return (
    <PresentDeckClient
      deckId={deckId}
      initialSlideIndex={initialSlideIndex}
    />
  )
}
