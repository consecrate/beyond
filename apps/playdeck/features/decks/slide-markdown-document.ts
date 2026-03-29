import type { DeckSlideView } from "@/features/decks/deck-types"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import type { RevealSlideModel } from "@/features/decks/slide-timeline"

export type ParsedSlide = { title: string; body: string }

const HEADING_LINE_RE = /^#{1,2}\s+(.+)$/

/**
 * Split deck Markdown on `\n---\n`. First `#` / `##` line in each chunk is the slide title.
 * Do not put a standalone `---` on its own line inside fenced code blocks (MVP limitation).
 */
export function parseMarkdownDocumentToSlides(md: string): ParsedSlide[] {
  const normalized = md.replace(/\r\n/g, "\n")
  if (normalized.trim() === "") return []

  const chunks = normalized.split(/\n---\n/)
  return chunks.map((chunk) => parseChunk(chunk))
}

function parseChunk(chunk: string): ParsedSlide {
  const trimmed = chunk.trim()
  if (trimmed === "") return { title: "", body: "" }

  const lines = trimmed.split("\n")
  let firstNonEmpty = -1
  let firstLine = ""
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line !== "") {
      firstNonEmpty = i
      firstLine = line
      break
    }
  }
  if (firstNonEmpty === -1) return { title: "", body: "" }

  const m = firstLine.match(HEADING_LINE_RE)
  if (!m) {
    return { title: "", body: trimmed }
  }

  const title = m[1].trim()
  const rest = lines.slice(firstNonEmpty + 1).join("\n")
  return { title, body: rest.replace(/^\n+/, "") }
}

/** Serialize slide rows to a single Markdown document with `---` slide breaks. */
export function slidesToMarkdownDocument(slides: DeckSlideView[]): string {
  if (slides.length === 0) return ""
  return slides.map((s) => slideRowToChunk(s)).join("\n---\n")
}

function slideRowToChunk(slide: DeckSlideView): string {
  const t = slide.title.trim()
  if (t !== "") {
    const body = slide.body.replace(/^\s+/, "")
    return `# ${t}\n\n${body}`
  }
  return slide.body.trim()
}

/** Same mapping as Present mode: HTML from body Markdown; title for grid labels. */
export function deckSlidesToRevealModels(
  slides: ParsedSlide[],
): RevealSlideModel[] {
  return slides.map((s) => ({
    title: s.title,
    html: slideMarkdownToSafeHtml(s.body),
  }))
}
