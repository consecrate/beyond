/**
 * Poll slide body (under the slide `#` title): optional `##` subtitle, `?` prompt,
 * `1.`…`n.` options (2–5). Legacy decks may end with `**Poll:**` (optional).
 */

export type PollBlock = {
  type: "poll"
  pollKey: string
  title?: string
  prompt: string
  /** Length 2–5 (enforced by parser). */
  options: readonly string[]
}

/** Minimal valid poll body for editor snippets. */
export const DEFAULT_POLL_SLIDE_BODY = `? Your question here?

1. First choice
2. Second choice
`

/** Full slide chunk (title + body) for “Add poll” in the deck editor. */
export const DEFAULT_POLL_SLIDE_CHUNK = `# Poll\n\n${DEFAULT_POLL_SLIDE_BODY}`

/** Append a new slide after `---` (deck document convention). */
export function appendPollSlideMarkdown(existing: string): string {
  const t = existing.trimEnd()
  if (!t) return DEFAULT_POLL_SLIDE_CHUNK
  return `${t}\n---\n\n${DEFAULT_POLL_SLIDE_CHUNK}`
}

/** Deterministic short id from poll identity fields (browser-safe). */
export function computePollKey(parts: {
  title?: string
  prompt: string
  options: readonly string[]
}): string {
  const t = (parts.title ?? "").trim()
  const p = parts.prompt.trim()
  const opts = parts.options.map((o) => o.trim()).join("\u001e")
  const s = `${t}\u001f${p}\u001f${opts}`
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  return `poll_${(h >>> 0).toString(36)}`
}

/**
 * If `body` is a full poll block, returns the structured poll; otherwise `null`.
 */
export function tryParsePollFromSlideBody(body: string): PollBlock | null {
  const r = parsePollSegment(body)
  return r.ok ? r.block : null
}

function parsePollSegment(
  text: string,
): { ok: true; block: PollBlock } | { ok: false; reason: string } {
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
    if (tr.startsWith("**") && /Poll/i.test(tr)) {
      return { ok: false, reason: "Missing prompt line starting with ? before **Poll:**." }
    }
    i++
  }

  if (i >= lines.length || !lines[i].trim().startsWith("?")) {
    return { ok: false, reason: "Poll requires a prompt line starting with ?." }
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
    if (tr.startsWith("**") && /Poll/i.test(tr)) {
      return { ok: false, reason: "Missing options before **Poll:**." }
    }
    promptParts.push(line)
    i++
  }

  const prompt = promptParts.join("\n").trim()

  while (i < lines.length && lines[i].trim() === "") i++

  const options: string[] = []
  let optNum = 1
  while (optNum <= 5) {
    const line = lines[i]
    if (line == null) {
      break
    }
    const om = new RegExp(`^\\s*${optNum}\\.\\s+(.+)$`).exec(line)
    if (!om) {
      break
    }
    options.push(om[1].trim())
    i++
    optNum++
  }

  if (options.length < 2) {
    return { ok: false, reason: "Poll requires at least two options (1. … 2. …)." }
  }
  if (options.length > 5) {
    return { ok: false, reason: "Poll allows at most five options." }
  }

  while (i < lines.length && lines[i].trim() === "") i++

  const maybeLine = lines[i]
  if (maybeLine != null) {
    const tr = maybeLine.trim()
    if (tr !== "") {
      const pollMatch =
        /^\*\*Poll:\*\*\s*(.*)$/.exec(tr) ?? /^Poll:\s*(.*)$/i.exec(tr)
      if (pollMatch) {
        i++
        while (i < lines.length && lines[i].trim() === "") i++
      } else {
        return { ok: false, reason: "Unexpected content after poll." }
      }
    }
  }

  if (i < lines.length && lines[i].trim() !== "") {
    return { ok: false, reason: "Unexpected content after poll." }
  }

  const pollKey = computePollKey({ title, prompt, options })

  const block: PollBlock = {
    type: "poll",
    pollKey,
    ...(title != null ? { title } : {}),
    prompt,
    options,
  }
  return { ok: true, block }
}
