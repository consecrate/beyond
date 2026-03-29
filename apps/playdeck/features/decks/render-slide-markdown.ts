import DOMPurify from "isomorphic-dompurify"
import { marked } from "marked"

marked.setOptions({ gfm: true, breaks: true })

export function slideMarkdownToSafeHtml(markdown: string): string {
  const src = markdown.trim() === "" ? "<p></p>" : markdown
  const html = marked.parse(src, { async: false }) as string
  return DOMPurify.sanitize(html)
}
