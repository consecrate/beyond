import { describe, expect, it } from "vitest"

import type { DeckSlideView } from "@/features/decks/deck-types"
import {
  computePollKey,
  DEFAULT_POLL_SLIDE_CHUNK,
  tryParsePollFromSlideBody,
} from "@/features/decks/parse-slide-poll"
import {
  deckSlidesToRevealModels,
  markdownMatchesSlides,
  parseMarkdownDocumentToSlides,
  presenterRevealSlidesFromSources,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"

function viewsFromParsed(
  slides: ReturnType<typeof parseMarkdownDocumentToSlides>,
): DeckSlideView[] {
  return slides.map((s, i) => ({
    id: `test-slide-${i}`,
    title: s.title,
    body: s.body,
    updated_at: "",
  }))
}

describe("parseMarkdownDocumentToSlides", () => {
  it("parses a two-slide deck", () => {
    const md = `# One\n\nalpha\n\n---\n\n# Two\n\nbeta\n`
    const slides = parseMarkdownDocumentToSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ title: "One", body: "alpha" })
    expect(slides[1]).toEqual({ title: "Two", body: "beta" })
  })

  it("handles repeated --- separators and blank chunks", () => {
    const md = `# Hello\n\n---\n\n---\n\n---\n\n---\n\n---\n\n`
    const slides = parseMarkdownDocumentToSlides(md)
    expect(slides.length).toBeGreaterThanOrEqual(1)
    expect(slides[0]).toEqual({ title: "Hello", body: "" })
  })

  it("treats undefined/null like empty document", () => {
    expect(parseMarkdownDocumentToSlides(undefined)).toEqual([])
    expect(parseMarkdownDocumentToSlides(null)).toEqual([])
  })

  it("normalizes \\r\\n and non-heading chunk", () => {
    const md = `Plain line one\r\n\r\nPlain line two\r\n---\r\n\r\n# Titled\r\n\r\ninside\r\n`
    const slides = parseMarkdownDocumentToSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ title: "", body: "Plain line one\n\nPlain line two" })
    expect(slides[1]).toEqual({ title: "Titled", body: "inside" })
  })

  it("returns [] for empty / whitespace-only document", () => {
    expect(parseMarkdownDocumentToSlides("")).toEqual([])
    expect(parseMarkdownDocumentToSlides("   \n  \n")).toEqual([])
  })

  it("parses heading-only slide then slide with body", () => {
    const md = `# Only title\n\n---\n\n# Second\n\nbody\n`
    const slides = parseMarkdownDocumentToSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ title: "Only title", body: "" })
    expect(slides[1]).toEqual({ title: "Second", body: "body" })
  })

  it("aligns with --- split for mixed empty and titled chunks", () => {
    const md = `a\n\n---\n\n\n# Hi\n\nb\n`
    const slides = parseMarkdownDocumentToSlides(md)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toEqual({ title: "", body: "a" })
    expect(slides[1]).toEqual({ title: "Hi", body: "b" })
  })
})

describe("markdownMatchesSlides", () => {
  it("returns true when markdown uses ## but slides match parsed title/body", () => {
    const md = `## Hello\n\nthis is really\n\n---\n\n## nice\n\nuhmmm\n`
    const views = viewsFromParsed(parseMarkdownDocumentToSlides(md))
    expect(markdownMatchesSlides(md, views)).toBe(true)
  })

  it("returns true for canonical # headings against same slide views", () => {
    const md = `# Hello\n\nbody\n`
    const views = viewsFromParsed(parseMarkdownDocumentToSlides(md))
    expect(markdownMatchesSlides(md, views)).toBe(true)
  })

  it("returns false when slide title differs", () => {
    const md = `# One\n\na\n`
    const other = viewsFromParsed(parseMarkdownDocumentToSlides(`# Two\n\na\n`))
    expect(markdownMatchesSlides(md, other)).toBe(false)
  })

  it("returns false when slide body differs", () => {
    const md = `# T\n\nalpha\n`
    const other = viewsFromParsed(parseMarkdownDocumentToSlides(`# T\n\nbeta\n`))
    expect(markdownMatchesSlides(md, other)).toBe(false)
  })

  it("returns false when slide count differs", () => {
    const md = `# A\n\n---\n\n# B\n\n`
    const oneSlide = viewsFromParsed(parseMarkdownDocumentToSlides(`# A\n\n`))
    expect(markdownMatchesSlides(md, oneSlide)).toBe(false)
  })
})

describe("slidesToMarkdownDocument round-trip", () => {
  it("preserves trailing --- when the next slide is empty (in-progress slide break)", () => {
    const md = `This is really nice.\n\n---\n\n`
    const parsed = parseMarkdownDocumentToSlides(md)
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toEqual({ title: "", body: "" })
    const out = slidesToMarkdownDocument(viewsFromParsed(parsed))
    expect(out).toMatch(/\n---\n/)
    expect(parseMarkdownDocumentToSlides(out)).toEqual(parsed)
  })

  it("round-trips heading slide plus empty trailing chunk", () => {
    const md = `# First\n\n---\n\n`
    const parsed = parseMarkdownDocumentToSlides(md)
    expect(parsed).toHaveLength(2)
    const out = slidesToMarkdownDocument(viewsFromParsed(parsed))
    expect(out).toMatch(/\n---\n/)
    expect(parseMarkdownDocumentToSlides(out)).toEqual(parsed)
  })
})

describe("tryParsePollFromSlideBody", () => {
  it("parses minimal body without **Poll:**", () => {
    const b = tryParsePollFromSlideBody(`? Q?

1. A
2. B
`)
    expect(b).not.toBeNull()
    expect(b?.prompt).toBe("Q?")
    expect(b?.options).toEqual(["A", "B"])
  })

  it("parses legacy body with **Poll:**", () => {
    const b = tryParsePollFromSlideBody(`? Q?

1. A
2. B

**Poll:**
`)
    expect(b).not.toBeNull()
    expect(b?.options).toEqual(["A", "B"])
  })

  it("still parses optional ## subtitle", () => {
    const b = tryParsePollFromSlideBody(`## Custom

? Q?

1. A
2. B
`)
    expect(b).not.toBeNull()
    expect(b?.title).toBe("Custom")
  })

  it("rejects trailing content after options", () => {
    expect(
      tryParsePollFromSlideBody(`? Q?

1. A
2. B

oops extra`),
    ).toBeNull()
  })
})

describe("deckSlidesToRevealModels + poll", () => {
  it("sets poll and empty html for a poll slide body", () => {
    const md = `${DEFAULT_POLL_SLIDE_CHUNK}\n`
    const parsed = parseMarkdownDocumentToSlides(md)
    const models = deckSlidesToRevealModels(parsed)
    expect(models).toHaveLength(1)
    expect(models[0].poll).not.toBeNull()
    expect(models[0].poll?.options.length).toBeGreaterThanOrEqual(2)
    expect(models[0].html).toBe("")
  })

  it("merges slide # title into poll and pollKey when body has no ##", () => {
    const md = `# Poll

? Q?

1. A
2. B
`
    const models = deckSlidesToRevealModels(parseMarkdownDocumentToSlides(md))
    expect(models[0].poll?.title).toBe("Poll")
    expect(models[0].poll?.pollKey).toBe(
      computePollKey({ title: "Poll", prompt: "Q?", options: ["A", "B"] }),
    )
  })

  it("leaves html for non-poll slides", () => {
    const md = `# Hi\n\nSome **text**.\n`
    const models = deckSlidesToRevealModels(parseMarkdownDocumentToSlides(md))
    expect(models[0].poll).toBeNull()
    expect(models[0].html).toContain("text")
  })
})

describe("presenterRevealSlidesFromSources", () => {
  it("matches deck-only mapping when live markdown is omitted", () => {
    const md = `# Poll\n\n? Q?\n\n1. A\n2. B\n`
    const views = viewsFromParsed(parseMarkdownDocumentToSlides(md))
    const fromHelper = presenterRevealSlidesFromSources({
      liveMarkdown: undefined,
      deckViews: views,
    })
    const direct = deckSlidesToRevealModels(parseMarkdownDocumentToSlides(md))
    expect(fromHelper).toEqual(direct)
  })

  it("falls back to deck when live markdown is empty or whitespace", () => {
    const md = `# T\n\nbody\n`
    const views = viewsFromParsed(parseMarkdownDocumentToSlides(md))
    const a = presenterRevealSlidesFromSources({ liveMarkdown: "", deckViews: views })
    const b = presenterRevealSlidesFromSources({
      liveMarkdown: "   \n",
      deckViews: views,
    })
    const c = presenterRevealSlidesFromSources({ liveMarkdown: undefined, deckViews: views })
    expect(a).toEqual(c)
    expect(b).toEqual(c)
  })

  it("uses live markdown for poll identity when deck has diverged", () => {
    const liveMd = `# Poll\n\n? Old?\n\n1. A\n2. B\n`
    const deckMd = `# Poll\n\n? New?\n\n1. A\n2. B\n`
    const deckViews = viewsFromParsed(parseMarkdownDocumentToSlides(deckMd))
    const fromLive = presenterRevealSlidesFromSources({
      liveMarkdown: liveMd,
      deckViews,
    })
    const fromDeckOnly = presenterRevealSlidesFromSources({
      liveMarkdown: undefined,
      deckViews,
    })
    expect(fromLive[0].poll?.prompt).toBe("Old?")
    expect(fromDeckOnly[0].poll?.prompt).toBe("New?")
    expect(fromLive[0].poll?.pollKey).not.toBe(fromDeckOnly[0].poll?.pollKey)
  })
})
