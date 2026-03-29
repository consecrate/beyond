import type { Loaded } from "jazz-tools"
import { Group } from "jazz-tools"

import { deckSlidesToViews } from "@/features/decks/deck-map"
import {
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import { Deck, LiveSession, PlaydeckAccount } from "@/features/jazz/schema"

export function startLiveSession(
  me: Loaded<typeof PlaydeckAccount>,
  deck: Loaded<typeof Deck>,
  activeSlideIndex: number,
):
  | { ok: true; liveSession: Loaded<typeof LiveSession> }
  | { ok: false; error: string } {
  const views = deckSlidesToViews(deck)
  if (views.length === 0) {
    return { ok: false, error: "No slides to broadcast." }
  }

  const g = Group.create(me)
  g.addMember("everyone", "reader")

  const max = views.length - 1
  const idx = Math.min(Math.max(0, activeSlideIndex), max)
  const markdown = slidesToMarkdownDocument(views)

  const liveSession = LiveSession.create(
    {
      deckTitle: deck.title,
      markdown,
      activeSlideIndex: idx,
      status: "live",
    },
    g,
  )

  return { ok: true, liveSession: liveSession as Loaded<typeof LiveSession> }
}

export function updateLiveSlideIndex(
  liveSession: Loaded<typeof LiveSession>,
  index: number,
): void {
  const n = parseMarkdownDocumentToSlides(liveSession.markdown).length
  if (n < 1) return
  const idx = Math.min(Math.max(0, index), n - 1)
  liveSession.$jazz.applyDiff({ activeSlideIndex: idx })
}

export function endLiveSession(liveSession: Loaded<typeof LiveSession>): void {
  liveSession.$jazz.applyDiff({ status: "ended" })
}
