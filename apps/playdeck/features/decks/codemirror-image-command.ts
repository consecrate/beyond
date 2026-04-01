import { Prec, type Extension } from "@codemirror/state"
import { keymap, type EditorView } from "@codemirror/view"

/**
 * CodeMirror extension: pressing Enter on a line that contains exactly `/image`
 * deletes that line and calls `onTrigger(lineFrom)` with the position of the deleted line.
 * The caller is responsible for opening a file picker and inserting the image at that position.
 */
export function imageCommandExtension(onTrigger: (insertAt: number) => void): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: "Enter",
        run(view: EditorView) {
          const { state } = view
          const { from } = state.selection.main
          const line = state.doc.lineAt(from)
          if (line.text.trim() !== "/image") return false

          // Delete the /image line (including newline if not first line)
          const deleteFrom = line.number > 1 ? line.from - 1 : line.from
          const deleteTo = line.to
          view.dispatch({
            changes: { from: deleteFrom, to: deleteTo, insert: "" },
          })

          const insertAt = deleteFrom

          // Defer so the editor updates before the file dialog opens
          setTimeout(() => onTrigger(insertAt), 0)

          return true
        },
      },
    ]),
  )
}
