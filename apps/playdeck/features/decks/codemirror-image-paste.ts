import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

export type ImageUploadFn = (blob: Blob) => Promise<{ id: string } | { error: string }>

/**
 * Replace `![uploading-<token>]()` with `![alt](jazz:<id>)` in a plain string.
 * Only replaces the first occurrence.
 */
export function replaceToken(doc: string, token: string, id: string, alt: string): string {
  return doc.replace(`![${token}]()`, `![${alt}](jazz:${id})`)
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
 * @param onUpload - async function that uploads a Blob and returns `{ id }` or `{ error }`
 */
export function imagePasteExtension(onUpload: ImageUploadFn): Extension {
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

          onUpload(blob).then((result) => {
            const current = view.state.doc.toString()
            if ("error" in result) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: deleteToken(current, token) },
              })
              return
            }
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: replaceToken(current, token, result.id, "image"),
              },
            })
          })
        }

        return true
      },
    }),
  )
}
