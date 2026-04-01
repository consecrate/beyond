import { parseImportedSlideBody } from "@/features/decks/parse-slide-import"

const SLIDE_SEPARATOR = "\n---\n"
const HEADING_LINE_RE = /^#{1,2}\s+(.+)$/

type SlideChunkInfo = {
  from: number
  to: number
  chunk: string
  title: string
  body: string
}

function parseChunk(chunk: string): { title: string; body: string } {
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

  const match = firstLine.match(HEADING_LINE_RE)
  if (!match) {
    return { title: "", body: trimmed }
  }

  return {
    title: match[1]!.trim(),
    body: lines.slice(firstNonEmpty + 1).join("\n").replace(/^\n+/, ""),
  }
}

function findSlideChunk(doc: string, pos: number): SlideChunkInfo {
  const safePos = Math.min(Math.max(0, pos), doc.length)
  const fromMarker = doc.lastIndexOf(SLIDE_SEPARATOR, safePos - 1)
  const toMarker = doc.indexOf(SLIDE_SEPARATOR, safePos)
  const from = fromMarker === -1 ? 0 : fromMarker + SLIDE_SEPARATOR.length
  const to = toMarker === -1 ? doc.length : toMarker
  const chunk = doc.slice(from, to)
  const parsed = parseChunk(chunk)
  return {
    from,
    to,
    chunk,
    title: parsed.title,
    body: parsed.body,
  }
}

function buildChunk(title: string, body: string): string {
  if (title.trim() === "") return body.trim()
  return `# ${title.trim()}\n\n${body.trim()}`
}

export function isImportSlideAtPosition(doc: string, pos: number): boolean {
  const info = findSlideChunk(doc, pos)
  const parsed = parseImportedSlideBody(info.body)
  return parsed.kind === "imported-image"
}

export function replaceSlideBodyAtPosition(
  doc: string,
  pos: number,
  body: string,
): { from: number; to: number; insert: string } {
  const info = findSlideChunk(doc, pos)
  return {
    from: info.from,
    to: info.to,
    insert: buildChunk(info.title, body),
  }
}
