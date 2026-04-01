import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import type { ImageUploadFn } from "@/features/decks/codemirror-image-paste"
import { deleteToken, replaceToken } from "@/features/decks/codemirror-image-paste"

/**
 * CodeMirror extension that handles dropping image files into the editor.
 * Non-image drops (text, non-image files) are not intercepted.
 * Multiple image files are processed sequentially.
 *
 * @param onUpload - async function that uploads a Blob and returns `{ id }` or `{ error }`
 */
export function imageDropExtension(onUpload: ImageUploadFn): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      drop(event, view) {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const imageFiles = files.filter((f) => f.type.startsWith("image/"))
        if (imageFiles.length === 0) return false // let CM handle normal drops

        event.preventDefault()

        // Resolve drop position from coordinates
        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length

        let insertOffset = dropPos

        for (const file of imageFiles) {
          const token = `uploading-${crypto.randomUUID()}`
          const placeholder = `![${token}]()\n`

          const pos = insertOffset
          view.dispatch({
            changes: { from: pos, insert: placeholder },
            selection: EditorSelection.cursor(pos + placeholder.length),
          })
          insertOffset += placeholder.length

          onUpload(file).then((result) => {
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
