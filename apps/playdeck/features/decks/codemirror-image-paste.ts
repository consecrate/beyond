import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

export type ImageUploadFn = (
  blob: Blob,
) => Promise<{ markdown: string } | { error: string }>
type DocChangeFn = (doc: string) => void

const UPLOADING_TOKEN_RE = /!\[uploading-[^[\]\n()]+\]\(\)/u

export function hasPendingImageUpload(doc: string): boolean {
  return UPLOADING_TOKEN_RE.test(doc)
}

/**
 * Replace `![uploading-<token>]()` with final image markdown in a plain string.
 * Only replaces the first occurrence.
 */
export function replaceToken(
  doc: string,
  token: string,
  finalMarkdown: string,
): string {
  return doc.replace(`![${token}]()`, finalMarkdown)
}

/**
 * Remove `![uploading-<token>]()` (and its surrounding newline if it's on its own line).
 */
export function deleteToken(doc: string, token: string): string {
  // Try to remove the whole line
  const linePattern = new RegExp(`\\n?!\\[${token}\\]\\(\\)\\n?`)
  const withLine = doc.replace(linePattern, (match) => {
    // Preserve one newline if there were two
    if (match.startsWith("\n") && match.endsWith("\n")) return "\n"
    return ""
  })
  if (withLine !== doc) return withLine
  // Fallback: remove inline occurrence
  return doc.replace(`![${token}]()`, "")
}

/**
 * CodeMirror extension that intercepts paste events containing image files.
 * Non-image pastes are not intercepted — normal paste behaviour is preserved.
 *
 * @param onUpload - async function that uploads a Blob and returns final markdown or an error
 */
export function imagePasteExtension(
  onUpload: ImageUploadFn,
  onDocChange?: DocChangeFn,
): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      paste(event, view) {
        const items = Array.from(event.clipboardData?.items ?? [])
        const imageItems = items.filter((item) => item.type.startsWith("image/"))
        if (imageItems.length === 0) return false // let normal paste proceed

        event.preventDefault()

        for (const item of imageItems) {
          const blob = item.getAsFile()
          if (!blob) continue

          const token = `uploading-${crypto.randomUUID()}`
          const placeholder = `![${token}]()`

          // Insert placeholder at current cursor
          const { from } = view.state.selection.main
          view.dispatch({
            changes: { from, insert: placeholder },
            selection: EditorSelection.cursor(from + placeholder.length),
          })
          onDocChange?.(view.state.doc.toString())

          onUpload(blob).then((result) => {
            // Find the placeholder token position in current doc
            const current = view.state.doc.toString()
            const placeholderText = `![${token}]()`
            const placeholderStart = current.indexOf(placeholderText)
            
            if (placeholderStart === -1) return // Token already removed
            
            if ("error" in result) {
              // Delete the placeholder (and surrounding newlines if on its own line)
              let deleteFrom = placeholderStart
              let deleteTo = placeholderStart + placeholderText.length
              
              // Check if preceded by newline
              if (placeholderStart > 0 && current[placeholderStart - 1] === "\n") {
                deleteFrom--
              }
              // Check if followed by newline (and we didn't already consume one)
              if (deleteTo < current.length && current[deleteTo] === "\n" && deleteFrom === placeholderStart) {
                deleteTo++
              }
              
              view.dispatch({
                changes: { from: deleteFrom, to: deleteTo, insert: "" },
              })
            } else {
              view.dispatch({
                changes: {
                  from: placeholderStart,
                  to: placeholderStart + placeholderText.length,
                  insert: result.markdown,
                },
              })
            }
            onDocChange?.(view.state.doc.toString())
          })
        }

        return true
      },
    }),
  )
}
