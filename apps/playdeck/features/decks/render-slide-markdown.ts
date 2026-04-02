import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"
import type { Tokens } from "marked"

marked.setOptions({ gfm: true, breaks: true })

// 1x1 transparent GIF placeholder to prevent broken image icon before Jazz loads
const PLACEHOLDER_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
const MARKDOWN_IMAGE_CLASS = "slide-markdown-image"

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/** Safe token for `language-*` class on fenced code (alphanumeric, dot, dash). */
function safeFenceLangToken(lang: string): string {
  const lower = lang.trim().toLowerCase()
  const aliases: Record<string, string> = {
    "c#": "csharp",
    "c++": "cpp",
    "f#": "fsharp",
  }
  return (aliases[lower] ?? lang).replace(/[^\w.-]/g, "")
}

type ParsedCodeFenceInfo = {
  language: string
  lineNumbers: string | null
}

function parseCodeFenceInfo(info: string | undefined): ParsedCodeFenceInfo {
  const trimmed = info?.trim() ?? ""
  if (trimmed === "") {
    return { language: "", lineNumbers: null }
  }

  let remaining = trimmed
  let lineNumbers: string | null = null

  const attrMatch = remaining.match(
    /\bdata-line-numbers\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/i,
  )
  if (attrMatch) {
    lineNumbers =
      (attrMatch[1] ?? attrMatch[2] ?? attrMatch[3] ?? "").trim() || null
    remaining = remaining.replace(attrMatch[0], "").trim()
  }

  const shorthandMatch = remaining.match(/(?:\{|\[)([\d,\-| ]+)(?:\}|\])\s*$/)
  if (!lineNumbers && shorthandMatch) {
    lineNumbers = shorthandMatch[1]?.trim() || null
    remaining = remaining.slice(0, shorthandMatch.index).trim()
  }

  const language = remaining.split(/\s+/, 1)[0] ?? ""
  return { language, lineNumbers }
}

function escapeCodeBlockHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

marked.use({
  renderer: {
    code({ text, lang, escaped }: Tokens.Code) {
      const fenceInfo = parseCodeFenceInfo(lang)
      const langToken =
        fenceInfo.language !== ""
          ? safeFenceLangToken(fenceInfo.language)
          : ""
      const langClass =
        langToken !== ""
          ? `language-${langToken}`
          : ""
      const lineNumbersAttr =
        fenceInfo.lineNumbers != null && fenceInfo.lineNumbers !== ""
          ? ` data-line-numbers="${escapeHtmlAttribute(fenceInfo.lineNumbers)}"`
          : ""
      const wrapperDataAttrs = [
        langToken !== "" ? ` data-language="${escapeHtmlAttribute(langToken)}"` : "",
        lineNumbersAttr,
      ].join("")
      const languageBadge =
        langToken !== ""
          ? `<div class="slide-codeblock-header"><span class="slide-codeblock-language">${escapeHtmlAttribute(langToken)}</span></div>`
          : ""
      const codeHtml = escaped ? text : escapeCodeBlockHtml(text)
      const codeClass =
        langClass !== ""
          ? `slide-codeblock-code ${langClass}`
          : "slide-codeblock-code"
      return `<div class="slide-codeblock"${wrapperDataAttrs}>${languageBadge}<pre class="slide-codeblock-pre"><code class="${codeClass}">${codeHtml}</code></pre></div>\n`
    },
    image({ href, title, text }) {
      if (href?.startsWith("jazz:")) {
        const id = href.slice("jazz:".length)
        return `<img src="${PLACEHOLDER_SRC}" data-jazz-id="${escapeHtmlAttribute(id)}" alt="${escapeHtmlAttribute(text ?? "")}" class="${MARKDOWN_IMAGE_CLASS} jazz-image jazz-image--loading" loading="lazy" decoding="async" />`
      }
      const titleAttr = title ? ` title="${escapeHtmlAttribute(title)}"` : ""
      return `<img src="${escapeHtmlAttribute(href ?? "")}" alt="${escapeHtmlAttribute(text ?? "")}"${titleAttr} class="${MARKDOWN_IMAGE_CLASS}" loading="lazy" decoding="async" />`
    },
  },
})

export function slideMarkdownToSafeHtml(markdown: string): string {
  const src = markdown.trim() === "" ? "<p></p>" : markdown
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-jazz-id", "data-language", "data-line-numbers"],
  })
}
