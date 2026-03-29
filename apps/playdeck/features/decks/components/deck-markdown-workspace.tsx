import Link from "next/link"

import type { DeckSlideView } from "@/features/decks/deck-types"
import { EditableDeckTitle } from "@/features/decks/components/editable-deck-title"
import { DeckEditorWorkspace } from "@/features/decks/components/deck-editor-workspace"
import { PresenterAccountMenu } from "@/features/presenter-shell"
import { buttonVariants, cn } from "@beyond/design-system"
import { ChevronLeft, Presentation } from "lucide-react"

type Props = {
  deckId: string
  initialTitle: string
  slides: DeckSlideView[]
  displayName: string
}

export function DeckMarkdownWorkspace({
  deckId,
  initialTitle,
  slides,
  displayName,
}: Props) {
  const presentHref = `/presenter/decks/${deckId}/present`

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="relative flex h-11 shrink-0 items-center border-b border-border px-2">
        <div className="flex min-w-0 flex-1 justify-start">
          <Link
            href="/presenter/decks"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-lg" }),
              "shrink-0 text-muted-foreground",
            )}
            aria-label="Back to decks"
          >
            <ChevronLeft className="size-5" />
          </Link>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-28 sm:px-32">
          <div className="pointer-events-auto w-full max-w-[min(560px,50vw)] min-w-0">
            <EditableDeckTitle
              deckId={deckId}
              initialTitle={initialTitle}
              appearance="chrome"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <Link
            href={presentHref}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "shrink-0 gap-2",
            )}
          >
            <Presentation className="h-4 w-4" />
            Present
          </Link>
          <PresenterAccountMenu displayName={displayName} />
        </div>
      </header>

      <DeckEditorWorkspace key={deckId} deckId={deckId} slides={slides} />
    </div>
  )
}
