import { describe, expect, it } from "vitest"

import type { DeckSlideView } from "@/features/decks/deck-types"
import {
  markdownMatchesSlides,
  parseMarkdownDocumentToSlides,
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
