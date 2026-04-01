import DOMPurify from "isomorphic-dompurify"
import { marked, type Renderer } from "marked"

marked.setOptions({ gfm: true, breaks: true })

const renderer: Partial<Renderer> = {
  image({ href, text }) {
    if (href?.startsWith("jazz:")) {
      const id = href.slice("jazz:".length)
      return `<img data-jazz-id="${id}" alt="${text ?? ""}" class="jazz-image" />`
    }
    // Fall through to default rendering for all other URLs
    return false
  },
}

marked.use({ renderer })

export function slideMarkdownToSafeHtml(markdown: string): string {
  const src = markdown.trim() === "" ? "<p></p>" : markdown
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-jazz-id"] })
}
