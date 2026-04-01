import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import type { ImageUploadFn } from "@/features/decks/codemirror-image-paste"
import {
  isImportSlideAtPosition,
  replaceSlideBodyAtPosition,
} from "@/features/decks/slide-markdown-editor-utils"

type DocChangeFn = (doc: string) => void

/**
 * CodeMirror extension that handles dropping image files into the editor.
 * Non-image drops (text, non-image files) are not intercepted.
 * Multiple image files are processed sequentially.
 *
 * @param onUpload - async function that uploads a Blob and returns final markdown or an error
 */
export function imageDropExtension(
  onUpload: ImageUploadFn,
  onDocChange?: DocChangeFn,
): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      drop(event, view) {
        const files = Array.from(event.dataTransfer?.files ?? [])
        const imageFiles = files.filter((f) => f.type.startsWith("image/"))
        if (imageFiles.length === 0) return false // let CM handle normal drops

        event.preventDefault()

        // Resolve drop position from coordinates
        const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length

        if (isImportSlideAtPosition(view.state.doc.toString(), dropPos)) {
          const file = imageFiles[0]
          if (!file) return true
          onUpload(file, { mode: "imported-slide" }).then((result) => {
            if ("error" in result) return
            const currentDoc = view.state.doc.toString()
            const change = replaceSlideBodyAtPosition(
              currentDoc,
              dropPos,
              result.markdown,
            )
            view.dispatch({ changes: change })
            onDocChange?.(view.state.doc.toString())
          })
          return true
        }

        let insertOffset = dropPos

        for (const file of imageFiles) {
          const token = `uploading-${crypto.randomUUID()}`
          const placeholder = `![${token}]()\n`

          const pos = insertOffset
          view.dispatch({
            changes: { from: pos, insert: placeholder },
            selection: EditorSelection.cursor(pos + placeholder.length),
          })
          onDocChange?.(view.state.doc.toString())
          insertOffset += placeholder.length

          onUpload(file, { mode: "inline" }).then((result) => {
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
              const afterPlaceholder = placeholderStart + placeholderText.length
              if (afterPlaceholder < current.length && current[afterPlaceholder] === "\n" && deleteFrom === placeholderStart) {
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
