/**
 * Blocked lesson Markdown contract (Math Academy–style):
 *
 * - Split screens with a horizontal rule on its own line: `---` (surrounded by newlines).
 * - Content block: any Markdown segment that is not an MCQ (optional leading `## Title` for the card).
 * - MCQ block (exactly five options, one correct):
 *   - Optional `## Title`
 *   - Prompt: lines starting with `?` on the first line (the `?` is stripped); continuation lines until `1.` … `5.` options begin (for display math, code, etc.).
 *   - Options: lines `1.` … `5.` (ordered, one line each).
 *   - `**Correct:**` followed by `1`–`5` or `A`–`E` (case-insensitive).
 *   - `**Explain:**` followed by explanation (rest of block; may span lines).
 *
 * Examples (comment-only):
 * // parseLessonMarkdownToBlocks("## Intro\n\nHello.\n\n---\n## Check\n\n? Compute $2+2$?\n\n1. 3\n2. 4\n3. 5\n4. 6\n5. 7\n\n**Correct:** 2\n**Explain:** $2+2=4$.") → 2 blocks
 */

export type ContentBlock = {
  type: "content"
  title?: string
  markdown: string
}

export type McqBlock = {
  type: "mcq"
  title?: string
  prompt: string
  options: [string, string, string, string, string]
  correctIndex: number
  explanation: string
}

export type LessonBlock = ContentBlock | McqBlock

export type ParseLessonMarkdownResult =
  | { ok: true; blocks: LessonBlock[] }
  | { ok: false; error: string }

const SPLIT_RE = /\n---\s*\n/

function stripOptionalH2Title(body: string): { title?: string; rest: string } {
  const trimmed = body.trim()
  const m = /^##\s+(.+?)(?:\r?\n|$)/.exec(trimmed)
  if (!m) return { rest: trimmed }
  const title = m[1].trim()
  const rest = trimmed.slice(m[0].length).trim()
  return { title, rest }
}

function segmentLooksIncompleteMcq(text: string): boolean {
  const t = text.trim()
  if (/\*\*Correct:\*\*/i.test(t) || /^Correct:\s*\S/m.test(t)) return true
  if (/\*\*Explain:\*\*/i.test(t) && /^\s*\d+\.\s/m.test(t)) return true
  return false
}

function parseMcqSegment(text: string): { ok: true; block: McqBlock } | { ok: false; reason: string } {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n")
  const lines = rawLines
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i++

  let title: string | undefined
  const firstLine = lines[i]?.trim() ?? ""
  const h2 = /^##\s+(.+)$/.exec(firstLine)
  if (h2) {
    title = h2[1].trim()
    i++
    while (i < lines.length && lines[i].trim() === "") i++
  }

  while (i < lines.length) {
    const line = lines[i]
    const tr = line.trim()
    if (tr.startsWith("?")) {
      break
    }
    if (/^\d+\.\s/.test(tr)) {
      return { ok: false, reason: "Found numbered options before a prompt line starting with ?." }
    }
    if (tr.startsWith("**") && /Correct/i.test(tr)) {
      return { ok: false, reason: "Missing prompt line starting with ? before **Correct:**." }
    }
    i++
  }

  if (i >= lines.length || !lines[i].trim().startsWith("?")) {
    return { ok: false, reason: "MCQ requires a prompt line starting with ?." }
  }

  const firstPrompt = lines[i].trim().replace(/^\?+\s*/, "").trim()
  if (!firstPrompt) {
    return { ok: false, reason: "Prompt text is empty after ?." }
  }
  const promptParts: string[] = [firstPrompt]
  i++

  while (i < lines.length) {
    const line = lines[i]
    const tr = line.trim()
    if (/^\s*1\.\s+/.test(line)) {
      break
    }
    if (/^\d+\.\s/.test(tr)) {
      return { ok: false, reason: "Found numbered options before option 1." }
    }
    if (tr.startsWith("**") && /Correct/i.test(tr)) {
      return { ok: false, reason: "Missing options before **Correct:**." }
    }
    promptParts.push(line)
    i++
  }

  const prompt = promptParts.join("\n").trim()

  while (i < lines.length && lines[i].trim() === "") i++

  const options: string[] = []
  for (let n = 1; n <= 5; n++) {
    const line = lines[i]
    if (line == null) {
      return { ok: false, reason: `Expected option ${n}. … (line missing).` }
    }
    const om = new RegExp(`^\\s*${n}\\.\\s+(.+)$`).exec(line)
    if (!om) {
      return { ok: false, reason: `Expected line "${n}. …" for option ${n}.` }
    }
    options.push(om[1].trim())
    i++
  }

  while (i < lines.length && lines[i].trim() === "") i++

  const correctLine = lines[i]?.trim() ?? ""
  const correctMatch =
    /^\*\*Correct:\*\*\s*([1-5]|[A-Ea-e])\b/.exec(correctLine) ??
    /^Correct:\s*([1-5]|[A-Ea-e])\b/i.exec(correctLine)
  if (!correctMatch) {
    return { ok: false, reason: "Expected **Correct:** 1–5 or A–E after options." }
  }
  const token = correctMatch[1].toUpperCase()
  let correctIndex: number
  if (token >= "A" && token <= "E") {
    correctIndex = token.charCodeAt(0) - "A".charCodeAt(0)
  } else {
    const num = parseInt(token, 10)
    if (num < 1 || num > 5) {
      return { ok: false, reason: "Correct index must be between 1 and 5." }
    }
    correctIndex = num - 1
  }
  i++

  while (i < lines.length && lines[i].trim() === "") i++

  const explainLine = lines[i]?.trim() ?? ""
  const explainMatch =
    /^\*\*Explain:\*\*\s*(.*)$/.exec(explainLine) ?? /^Explain:\s*(.*)$/i.exec(explainLine)
  if (!explainMatch) {
    return { ok: false, reason: "Expected **Explain:** … after **Correct:**." }
  }
  let explanation = (explainMatch[1] ?? "").trim()
  i++
  const restLines: string[] = []
  while (i < lines.length) {
    restLines.push(lines[i])
    i++
  }
  const tail = restLines.join("\n").trim()
  if (tail) {
    explanation = explanation ? `${explanation}\n\n${tail}` : tail
  }

  if (!explanation) {
    return { ok: false, reason: "Explanation must not be empty." }
  }

  const block: McqBlock = {
    type: "mcq",
    ...(title != null ? { title } : {}),
    prompt,
    options: options as [string, string, string, string, string],
    correctIndex,
    explanation,
  }
  return { ok: true, block }
}

function parseContentSegment(text: string): ContentBlock {
  const { title, rest } = stripOptionalH2Title(text)
  return {
    type: "content",
    ...(title != null ? { title } : {}),
    markdown: rest,
  }
}

/**
 * Returns whether the document can be driven as a blocked lesson (at least one segment,
 * and no invalid MCQ segments). Single segment without `---` is always valid as one content block
 * unless it is a well-formed MCQ.
 */
export function parseLessonMarkdownToBlocks(markdown: string): ParseLessonMarkdownResult {
  const trimmed = markdown.trim()
  if (!trimmed) {
    return { ok: true, blocks: [] }
  }

  const segments = trimmed.split(SPLIT_RE).map((s) => s.trim()).filter((s) => s.length > 0)

  if (segments.length === 0) {
    return { ok: true, blocks: [] }
  }

  const blocks: LessonBlock[] = []

  for (let s = 0; s < segments.length; s++) {
    const segment = segments[s]
    const mcqTry = parseMcqSegment(segment)
    if (mcqTry.ok) {
      blocks.push(mcqTry.block)
      continue
    }

    if (segmentLooksIncompleteMcq(segment)) {
      return {
        ok: false,
        error: `Invalid MCQ block (segment ${s + 1}): ${mcqTry.reason}`,
      }
    }

    blocks.push(parseContentSegment(segment))
  }

  return { ok: true, blocks }
}

/*
 * Sample calls (intended results only — not executed):
 *
 * parseLessonMarkdownToBlocks("# x") → ok, one content block (no leading ## title)
 * parseLessonMarkdownToBlocks("## T\n\nbody") → ok, content title T, markdown "body"
 * parseLessonMarkdownToBlocks("a\n---\nb") → ok, two content blocks
 */
