import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Presentation } from "lucide-react"

import { getDeckWithSlides } from "@/features/decks/queries"
import { DeckMetadataForm } from "@/features/decks/components/deck-metadata-form"
import { buttonVariants, cn } from "@beyond/design-system"

type RouteProps = {
  params: Promise<{ deckId: string }>
}

export async function generateMetadata({ params }: RouteProps) {
  const { deckId } = await params
  try {
    const { deck } = await getDeckWithSlides(deckId)
    return { title: `${deck.title} — PlayDeck` }
  } catch {
    return { title: "Deck — PlayDeck" }
  }
}

export default async function DeckEditorPage({ params }: RouteProps) {
  const { deckId } = await params

  const result = await getDeckWithSlides(deckId).catch(() => null)
  if (!result) redirect("/presenter/decks")

  const { deck, slides } = result

  return (
    <div className="mx-auto max-w-4xl xl:max-w-5xl">
      <div className="mb-6">
        <Link
          href="/presenter/decks"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to decks
        </Link>
      </div>

      <DeckMetadataForm deck={deck} />

      <div className="mt-10 rounded-3xl border border-border/80 bg-muted/10 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Slides</h2>
            <p className="text-sm text-muted-foreground">
              {slides.length === 0
                ? "No slides yet."
                : `${slides.length} slide${slides.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Link
            href={`/presenter/decks/${deckId}/edit`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Presentation className="mr-2 h-4 w-4" />
            Open slide editor
          </Link>
        </div>
      </div>
    </div>
  )
}
