import { parseImportedSlideBody } from "@/features/decks/parse-slide-import"
import type { DeckSlideView } from "@/features/decks/deck-types"
import {
  computePollKey,
  tryParsePollFromSlideBody,
} from "@/features/decks/parse-slide-poll"
import { parseQuestionSlideBody } from "@/features/decks/parse-slide-question"
import { tryParseCodeFromSlideBody } from "@/features/decks/parse-slide-code"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import type { RevealSlideModel } from "@/features/decks/slide-timeline"

export type ParsedSlide = { title: string; body: string }

const HEADING_LINE_RE = /^#{1,2}\s+(.+)$/

/**
 * Split deck Markdown on `\n---\n`. First `#` / `##` line in each chunk is the slide title.
 * Do not put a standalone `---` on its own line inside fenced code blocks (MVP limitation).
 * Treats missing `md` like empty string (e.g. Jazz field not synced yet).
 */
export function parseMarkdownDocumentToSlides(md?: string | null): ParsedSlide[] {
  const normalized = (md ?? "").replace(/\r\n/g, "\n")
  if (normalized.trim() === "") return []

  const clean = normalized.replace(/^---\n?/, "")
  const chunks = clean.split("\n---\n")
  return chunks.map((chunk) => parseChunk(chunk))
}

function parseChunk(chunk: string): ParsedSlide {
  const trimmed = chunk.trim()
  if (trimmed === "") return { title: "", body: "" }

  const lines = trimmed.split("\n")
  let firstNonEmpty = -1
  let firstLine = ""
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
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

  const title = m[1]!.trim()
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

/** True when `md` parses to the same slide title/body pairs as `slides` (ignores ids and timestamps). */
export function markdownMatchesSlides(
  md: string,
  slides: DeckSlideView[],
): boolean {
  const parsed = parseMarkdownDocumentToSlides(md)
  if (parsed.length !== slides.length) return false
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]!
    const v = slides[i]!
    if (p.title !== v.title.trim()) return false
    if (p.body !== v.body) return false
  }
  return true
}

/**
 * Presenter: while live, use frozen `LiveSession.markdown` so `pollKey` matches stored
 * `poll_votes`; otherwise use the current deck serialized to markdown.
 */
export function presenterRevealSlidesFromSources(args: {
  liveMarkdown: string | null | undefined
  deckViews: DeckSlideView[]
}): RevealSlideModel[] {
  const { liveMarkdown, deckViews } = args
  const md =
    typeof liveMarkdown === "string" && liveMarkdown.trim() !== ""
      ? liveMarkdown
      : slidesToMarkdownDocument(deckViews)
  return deckSlidesToRevealModels(parseMarkdownDocumentToSlides(md))
}

/** Same mapping as Present mode: HTML from body Markdown; poll slides use `poll` and empty `html`. */
export function deckSlidesToRevealModels(
  slides: ParsedSlide[],
): RevealSlideModel[] {
  return slides.map((s) => {
    const imported = parseImportedSlideBody(s.body)
    if (imported.kind === "invalid-import") {
      return {
        title: s.title,
        html: "",
        importedImage: null,
        poll: null,
        question: null,
        code: null,
        interactiveError: imported.block,
      }
    }

    if (imported.kind === "imported-image") {
      return {
        title: s.title,
        html: "",
        importedImage: imported.block,
        poll: null,
        question: null,
        code: null,
        interactiveError: null,
      }
    }

    const question = parseQuestionSlideBody({
      slideTitle: s.title,
      body: s.body,
    })

    if (question.kind === "invalid-question") {
      return {
        title: s.title,
        html: "",
        importedImage: null,
        poll: null,
        question: null,
        code: null,
        interactiveError: question.block,
      }
    }

    if (question.kind === "question") {
      return {
        title: s.title,
        html: "",
        importedImage: null,
        poll: null,
        question: question.block,
        code: null,
        interactiveError: null,
      }
    }

    const rawCode = tryParseCodeFromSlideBody(s.body)
    if (rawCode) {
      return {
        title: s.title,
        html: "",
        importedImage: null,
        poll: null,
        question: null,
        code: rawCode,
        interactiveError: null,
      }
    }

    const raw = tryParsePollFromSlideBody(s.body)
    if (!raw) {
      return {
        title: s.title,
        html: slideMarkdownToSafeHtml(s.body),
        importedImage: null,
        poll: null,
        question: null,
        code: null,
        interactiveError: null,
      }
    }
    const mergedTitle =
      (raw.title?.trim() || s.title.trim()) || undefined
    const poll = {
      type: "poll" as const,
      prompt: raw.prompt,
      options: raw.options,
      pollKey: computePollKey({
        title: mergedTitle ?? "",
        prompt: raw.prompt,
        options: raw.options,
      }),
      ...(mergedTitle ? { title: mergedTitle } : {}),
    }
    return {
      title: s.title,
      html: "",
      importedImage: null,
      poll,
      question: null,
      code: null,
      interactiveError: null,
    }
  })
}
