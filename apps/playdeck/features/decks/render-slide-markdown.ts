import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"

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

marked.use({
  renderer: {
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
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-jazz-id"] })
}
