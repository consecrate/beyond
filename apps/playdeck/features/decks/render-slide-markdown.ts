import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"

marked.setOptions({ gfm: true, breaks: true })

marked.use({
  renderer: {
    image({ href, title, text }) {
      if (href?.startsWith("jazz:")) {
        const id = href.slice("jazz:".length)
        return `<img data-jazz-id="${id}" alt="${text ?? ""}" class="jazz-image" />`
      }
      // Return default rendering for all other URLs
      const titleAttr = title ? ` title="${title}"` : ""
      return `<img src="${href ?? ""}" alt="${text ?? ""}"${titleAttr} />`
    },
  },
})

export function slideMarkdownToSafeHtml(markdown: string): string {
  const src = markdown.trim() === "" ? "<p></p>" : markdown
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-jazz-id"] })
}
