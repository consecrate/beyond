/**
 * Question slide body (under the slide `#` title): optional `##` kicker, `?` prompt,
 * `1.`…`n.` answers (2–6), and exactly one `{correct}` marker.
 */

export type QuestionOption = {
  text: string
  isCorrect: boolean
}

export type QuestionBlock = {
  type: "question"
  questionKey: string
  kicker?: string
  prompt: string
  options: readonly QuestionOption[]
  correctOptionIndex: number
}

export type InvalidQuestionBlock = {
  type: "question"
  message: string
}

export type ParseQuestionResult =
  | { kind: "question"; block: QuestionBlock }
  | { kind: "invalid-question"; block: InvalidQuestionBlock }
  | { kind: "not-question" }

const CORRECT_MARKER_RE = /\{correct\}/gi

/** Minimal valid question body for editor snippets. */
export const DEFAULT_QUESTION_SLIDE_BODY = `## Warm-up

? Your question here?

1. Correct answer {correct}
2. Second choice
3. Third choice
4. Fourth choice
`

/** Full slide chunk (title + body) for “Add question” in the deck editor. */
export const DEFAULT_QUESTION_SLIDE_CHUNK = `# Question\n\n${DEFAULT_QUESTION_SLIDE_BODY}`

/** Append a new slide after `---` (deck document convention). */
export function appendQuestionSlideMarkdown(existing: string): string {
  const t = existing.trimEnd()
  if (!t) return DEFAULT_QUESTION_SLIDE_CHUNK
  return `${t}\n---\n\n${DEFAULT_QUESTION_SLIDE_CHUNK}`
}

export const DEFAULT_BATTLE_ROYALE_SLIDES = `# Battle Royale

---
# Question
? What React hook triggers a side effect?
1. useEffect {correct}
2. useState
3. useMemo
4. useCallback

---
# Question
? Which HTML tag is used to define an internal style sheet?
1. <style> {correct}
2. <css>
3. <script>
4. <link>

---
# Question
? What does CSS stand for?
1. Cascading Style Sheets {correct}
2. Colorful Style Sheets
3. Computer Style Sheets
4. Creative Style Sheets
`

export function appendBattleRoyaleMarkdown(existing: string): string {
  const t = existing.trimEnd()
  if (!t) return DEFAULT_BATTLE_ROYALE_SLIDES
  return `${t}\n---\n\n${DEFAULT_BATTLE_ROYALE_SLIDES}`
}

/** Deterministic short id from question identity fields (browser-safe). */
export function computeQuestionKey(parts: {
  title?: string
  kicker?: string
  prompt: string
  options: readonly string[]
  correctOptionIndex: number
}): string {
  const t = (parts.title ?? "").trim()
  const k = (parts.kicker ?? "").trim()
  const p = parts.prompt.trim()
  const opts = parts.options.map((o) => o.trim()).join("\u001e")
  const s = `${t}\u001f${k}\u001f${p}\u001f${opts}\u001f${parts.correctOptionIndex}`
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  return `question_${(h >>> 0).toString(36)}`
}

export function parseQuestionSlideBody(args: {
  slideTitle?: string
  body: string
}): ParseQuestionResult {
  return parseQuestionSegment(args)
}

function invalidQuestion(message: string): ParseQuestionResult {
  return {
    kind: "invalid-question",
    block: {
      type: "question",
      message,
    },
  }
}

function parseQuestionSegment(args: {
  slideTitle?: string
  body: string
}): ParseQuestionResult {
  const { slideTitle, body } = args
  const lines = body.replace(/\r\n/g, "\n").split("\n")
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i++

  let kicker: string | undefined
  const maybeKicker = lines[i]?.trim() ?? ""
  const h2 = /^##\s+(.+)$/.exec(maybeKicker)
  if (h2) {
    kicker = h2[1].trim()
    i++
    while (i < lines.length && lines[i].trim() === "") i++
  }

  const hasCorrectMarker = CORRECT_MARKER_RE.test(body)
  CORRECT_MARKER_RE.lastIndex = 0
  const titleActivatesQuestion = /^\s*question\b/i.test(slideTitle ?? "")
  const firstLine = lines[i]?.trim() ?? ""

  if (firstLine === "" && !hasCorrectMarker && !titleActivatesQuestion) {
    return { kind: "not-question" }
  }

  if (!firstLine.startsWith("?")) {
    return hasCorrectMarker || titleActivatesQuestion
      ? invalidQuestion(
        "Question slides must start with a prompt line beginning with `?`.",
      )
      : { kind: "not-question" }
  }

  const firstPrompt = firstLine.replace(/^\?+\s*/, "").trim()
  if (!firstPrompt) {
    return invalidQuestion(
      "Question slides must start with a prompt line beginning with `?`.",
    )
  }

  const promptParts: string[] = [firstPrompt]
  i++

  while (i < lines.length) {
    const line = lines[i] ?? ""
    const trimmed = line.trim()
    if (/^\s*1\.\s+/.test(line)) {
      break
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return invalidQuestion(
        "Question slides must have answers numbered sequentially from `1.`.",
      )
    }
    promptParts.push(line)
    i++
  }

  const prompt = promptParts.join("\n").trim()

  while (i < lines.length && lines[i].trim() === "") i++

  const options: QuestionOption[] = []
  let correctCount = 0
  let correctOptionIndex = -1
  let expected = 1

  while (expected <= 6) {
    const line = lines[i]
    if (line == null) break
    const match = new RegExp(`^\\s*${expected}\\.\\s+(.+)$`).exec(line)
    if (!match) break

    const rawText = match[1]
    const markers = rawText.match(CORRECT_MARKER_RE)?.length ?? 0
    CORRECT_MARKER_RE.lastIndex = 0
    const text = rawText.replace(CORRECT_MARKER_RE, "").trim()
    CORRECT_MARKER_RE.lastIndex = 0

    if (!text) {
      return invalidQuestion("Question answers cannot be empty.")
    }

    const isCorrect = markers > 0
    correctCount += markers
    if (isCorrect && correctOptionIndex === -1) {
      correctOptionIndex = options.length
    }

    options.push({ text, isCorrect })
    expected++
    i++
  }

  if (options.length < 2 || /^\s*7\.\s+/.test(lines[i] ?? "")) {
    return hasCorrectMarker || titleActivatesQuestion
      ? invalidQuestion("Question slides must have between 2 and 6 answers.")
      : { kind: "not-question" }
  }

  if (correctCount !== 1) {
    return hasCorrectMarker || titleActivatesQuestion
      ? invalidQuestion(
        "Question slides must have exactly one `{correct}` answer.",
      )
      : { kind: "not-question" }
  }

  while (i < lines.length && lines[i].trim() === "") i++
  if (i < lines.length) {
    return invalidQuestion(
      "Question slides may only contain an optional `##` kicker, the prompt, and the answers.",
    )
  }

  const title = slideTitle?.trim() || undefined
  const questionKey = computeQuestionKey({
    title,
    kicker,
    prompt,
    options: options.map((option) => option.text),
    correctOptionIndex,
  })

  return {
    kind: "question",
    block: {
      type: "question",
      questionKey,
      ...(kicker ? { kicker } : {}),
      prompt,
      options,
      correctOptionIndex,
    },
  }
}
