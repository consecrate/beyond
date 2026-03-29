import { EditorSelection, Prec, type Extension } from "@codemirror/state"
import { keymap, type EditorView } from "@codemirror/view"

function wrapMarkdown(
  view: EditorView,
  before: string,
  after: string,
  emptyCursorFromInsertStart: number,
) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const { from, to } = range
      if (from === to) {
        const insert = before + after
        return {
          changes: { from, to, insert },
          range: EditorSelection.cursor(from + emptyCursorFromInsertStart),
        }
      }
      const selected = view.state.sliceDoc(from, to)
      const insert = before + selected + after
      const innerFrom = from + before.length
      const innerTo = innerFrom + selected.length
      return {
        changes: { from, to, insert },
        range: EditorSelection.range(innerFrom, innerTo),
      }
    }),
  )
  return true
}

export const markdownFormattingKeymap: Extension = Prec.highest(
  keymap.of([
    { key: "Mod-b", run: (view) => wrapMarkdown(view, "**", "**", 2) },
    { key: "Mod-i", run: (view) => wrapMarkdown(view, "*", "*", 1) },
  ]),
)
