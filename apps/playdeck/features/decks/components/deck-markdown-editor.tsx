"use client"

import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { useTheme } from "next-themes"
import { useCallback, useMemo, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"

import { cn } from "@beyond/design-system"

import { markdownFormattingKeymap } from "@/features/decks/codemirror-markdown-formatting"
import {
  imagePasteExtension,
  type ImageUploadFn,
} from "@/features/decks/codemirror-image-paste"
import { imageDropExtension } from "@/features/decks/codemirror-image-drop"
import { imageCommandExtension } from "@/features/decks/codemirror-image-command"

type Props = {
  value: string
  onChange: (value: string) => void
  onImageUpload: ImageUploadFn
  className?: string
}

export function DeckMarkdownEditor({ value, onChange, onImageUpload, className }: Props) {
  const { resolvedTheme } = useTheme()
  const themeExt = useMemo(
    () => (resolvedTheme === "dark" ? githubDark : githubLight),
    [resolvedTheme],
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingInsertAtRef = useRef<number | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value // Keep ref in sync with prop

  const handleImageCommand = useCallback((insertAt: number) => {
    pendingInsertAtRef.current = insertAt
    fileInputRef.current?.click()
  }, [])

  // Use refs for callbacks to avoid recreating extensions
  const onChangeRef = useRef(onChange)
  const onImageUploadRef = useRef(onImageUpload)
  onChangeRef.current = onChange
  onImageUploadRef.current = onImageUpload

  const syncParentFromView = useCallback(
    (nextValue: string) => {
      onChangeRef.current(nextValue)
    },
    [],
  )

  const stableOnImageUpload = useCallback<ImageUploadFn>(
    (blob) => onImageUploadRef.current(blob),
    [],
  )

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      themeExt,
      markdownFormattingKeymap,
      imagePasteExtension(stableOnImageUpload, syncParentFromView),
      imageDropExtension(stableOnImageUpload, syncParentFromView),
      imageCommandExtension(handleImageCommand),
    ],
    [themeExt, stableOnImageUpload, syncParentFromView, handleImageCommand],
  )

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return

      const insertAt = pendingInsertAtRef.current ?? 0
      pendingInsertAtRef.current = null

      // Access the CM EditorView attached to the CodeMirror DOM node
      const editorDom = document.querySelector(".cm-editor") as (HTMLElement & { cmView?: EditorView }) | null
      const view = (editorDom as unknown as { CodeMirror?: { view?: EditorView } })?.CodeMirror?.view

      if (!view) {
        // Fallback: just call onImageUpload and insert into the document state
        // Read from ref at resolution time to get latest value
        onImageUploadRef.current(file).then((result) => {
          if ("markdown" in result) {
            const currentValue = valueRef.current
            onChangeRef.current(
              currentValue.slice(0, insertAt) +
                `${result.markdown}\n` +
                currentValue.slice(insertAt),
            )
          }
        })
        return
      }

      const token = `uploading-${crypto.randomUUID()}`
      const placeholder = `![${token}]()\n`

      view.dispatch({
        changes: { from: insertAt, insert: placeholder },
      })
      syncParentFromView(view.state.doc.toString())

      onImageUploadRef.current(file).then((result) => {
        // Find the placeholder token position in current doc
        const current = view.state.doc.toString()
        const placeholderText = `![${token}]()`
        const placeholderStart = current.indexOf(placeholderText)
        
        if (placeholderStart === -1) return // Token already removed
        
        if ("error" in result) {
          // Delete the placeholder with surrounding newlines
          let deleteFrom = placeholderStart
          let deleteTo = placeholderStart + placeholderText.length
          if (deleteTo < current.length && current[deleteTo] === "\n") {
            deleteTo++
          }
          view.dispatch({
            changes: { from: deleteFrom, to: deleteTo, insert: "" },
          })
        } else {
          // Include the newline in the replacement
          const actualPlaceholder = placeholderText + (current[placeholderStart + placeholderText.length] === "\n" ? "\n" : "")
          view.dispatch({
            changes: {
              from: placeholderStart,
              to: placeholderStart + actualPlaceholder.length,
              insert: result.markdown + "\n",
            },
          })
        }
        syncParentFromView(view.state.doc.toString())
      })
    },
    [syncParentFromView],
  )

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
        aria-hidden
      />
      <CodeMirror
        theme="none"
        value={value}
        height="100%"
        className="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:flex [&_.cm-editor]:min-h-0 [&_.cm-editor]:h-full [&_.cm-editor]:flex-col [&_.cm-scroller]:h-full [&_.cm-scroller]:min-h-[260px]"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
        }}
      />
    </div>
  )
}
