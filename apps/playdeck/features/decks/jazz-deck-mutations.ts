import type { Loaded } from "jazz-tools"
import { assertLoaded, co } from "jazz-tools"

import { coValueId } from "@/features/decks/deck-map"
import { Deck, DeckSlide, PlaydeckAccount, PlaydeckRoot } from "@/features/jazz/schema"
import { parseMarkdownDocumentToSlides } from "@/features/decks/slide-markdown-document"

export function findDeck(
  root: Loaded<typeof PlaydeckRoot>,
  deckId: string,
): Loaded<typeof Deck> | undefined {
  const decks = root.decks
  assertLoaded(decks)
  for (const d of [...decks]) {
    assertLoaded(d)
    if (coValueId(d) === deckId) return d as Loaded<typeof Deck>
  }
  return undefined
}

function loadedAccountRoot(me: Loaded<typeof PlaydeckAccount>) {
  assertLoaded(me)
  assertLoaded(me.root)
  return me.root
}

export function createDeckFromTitle(
  me: Loaded<typeof PlaydeckAccount>,
  title: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = title.trim()
  if (!trimmed) return { ok: false, error: "Title is required." }

  const root = loadedAccountRoot(me)
  const decks = root.decks
  assertLoaded(decks)

  const now = new Date().toISOString()
  const slide = DeckSlide.create(
    {
      title: "",
      body: `# ${trimmed}\n\n`,
      slideKind: "simple",
    },
    me,
  )
  const deck = Deck.create(
    {
      title: trimmed,
      updatedAt: now,
      slides: co.list(DeckSlide).create([slide], me),
    },
    me,
  )
  decks.$jazz.push(deck)
  return { ok: true }
}

export function updateDeckTitle(
  me: Loaded<typeof PlaydeckAccount>,
  deckId: string,
  title: string,
): { ok: true } | { ok: false; error: string } {
  const trimmed = title.trim()
  if (!trimmed) return { ok: false, error: "Title is required." }

  const deck = findDeck(loadedAccountRoot(me), deckId)
  if (!deck) return { ok: false, error: "Deck not found." }

  deck.$jazz.applyDiff({
    title: trimmed,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export function replaceSlidesFromMarkdown(
  me: Loaded<typeof PlaydeckAccount>,
  deckId: string,
  markdown: string,
): { ok: true } | { ok: false; error: string } {
  const deck = findDeck(loadedAccountRoot(me), deckId)
  if (!deck) return { ok: false, error: "Deck not found." }

  const slides = parseMarkdownDocumentToSlides(markdown)
  if (slides.length === 0) {
    return { ok: false, error: "Add at least one slide (Markdown cannot be empty)." }
  }
  const hasContent = slides.some(
    (s) => s.title.trim() !== "" || s.body.trim() !== "",
  )
  if (!hasContent) {
    return { ok: false, error: "Add at least one slide (Markdown cannot be empty)." }
  }

  const now = new Date().toISOString()
  const newSlides = slides.map((s) =>
    DeckSlide.create(
      {
        title: s.title,
        body: s.body,
        slideKind: "simple",
      },
      me,
    ),
  )

  const list = deck.slides
  assertLoaded(list)
  const len = list.length
  if (len === 0) {
    list.$jazz.push(...newSlides)
  } else {
    list.$jazz.splice(0, len, ...newSlides)
  }

  deck.$jazz.applyDiff({ updatedAt: now })
  return { ok: true }
}

export function deleteDeckById(
  me: Loaded<typeof PlaydeckAccount>,
  deckId: string,
): { ok: true } | { ok: false; error: string } {
  const root = loadedAccountRoot(me)
  const decks = root.decks
  assertLoaded(decks)
  const idx = [...decks].findIndex((d) => {
    assertLoaded(d)
    return coValueId(d) === deckId
  })
  if (idx === -1) return { ok: false, error: "Deck not found." }
  decks.$jazz.splice(idx, 1)
  return { ok: true }
}
