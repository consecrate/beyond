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
  deleteToken,
  replaceToken,
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

  const handleImageCommand = useCallback((insertAt: number) => {
    pendingInsertAtRef.current = insertAt
    fileInputRef.current?.click()
  }, [])

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      themeExt,
      markdownFormattingKeymap,
      imagePasteExtension(onImageUpload),
      imageDropExtension(onImageUpload),
      imageCommandExtension(handleImageCommand),
    ],
    [themeExt, onImageUpload, handleImageCommand],
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
        const token = `uploading-${crypto.randomUUID()}`
        onImageUpload(file).then((result) => {
          if ("id" in result) {
            onChange(value.slice(0, insertAt) + `![image](jazz:${result.id})\n` + value.slice(insertAt))
          }
        })
        return
      }

      const token = `uploading-${crypto.randomUUID()}`
      const placeholder = `![${token}]()\n`

      view.dispatch({
        changes: { from: insertAt, insert: placeholder },
      })

      onImageUpload(file).then((result) => {
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
    },
    [onImageUpload, value, onChange],
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
