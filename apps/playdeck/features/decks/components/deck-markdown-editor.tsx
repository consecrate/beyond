"use client"

/* eslint-disable react-hooks/refs -- CodeMirror callbacks need latest props via ref sync; extensions close over stable wrappers */

import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { useTheme } from "next-themes"
import { useCallback, useMemo, useRef } from "react"
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"

import { cn } from "@beyond/design-system"

import { markdownFormattingKeymap } from "@/features/decks/codemirror-markdown-formatting"
import {
  imagePasteExtension,
  type ImageUploadFn,
  removeUploadingPlaceholderView,
} from "@/features/decks/codemirror-image-paste"
import { imageDropExtension } from "@/features/decks/codemirror-image-drop"
import { imageCommandExtension } from "@/features/decks/codemirror-image-command"
import {
  isImportSlideAtPosition,
  replaceSlideBodyAtPosition,
} from "@/features/decks/slide-markdown-editor-utils"

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
  const editorRef = useRef<ReactCodeMirrorRef>(null)
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
    (blob, options) => onImageUploadRef.current(blob, options),
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
      if (!file) {
        pendingInsertAtRef.current = null
        return
      }

      const insertAt = pendingInsertAtRef.current ?? 0
      pendingInsertAtRef.current = null

      // Access the CM EditorView from the CodeMirror React component ref
      const view = editorRef.current?.view
      const currentDoc = valueRef.current
      const isImportSlide = isImportSlideAtPosition(currentDoc, insertAt)

      if (!view) {
        onImageUploadRef
          .current(file, {
            mode: isImportSlide ? "imported-slide" : "inline",
          })
          .then((result) => {
            if ("markdown" in result) {
              const latestValue = valueRef.current
              if (isImportSlide) {
                const change = replaceSlideBodyAtPosition(
                  latestValue,
                  insertAt,
                  result.markdown,
                )
                onChangeRef.current(
                  latestValue.slice(0, change.from) +
                    change.insert +
                    latestValue.slice(change.to),
                )
                return
              }

              onChangeRef.current(
                latestValue.slice(0, insertAt) +
                  `${result.markdown}\n` +
                  latestValue.slice(insertAt),
              )
            }
          })
          .catch((err: unknown) => {
            console.error("image upload failed (no editor view)", err)
          })
        return
      }

      if (isImportSlide) {
        void onImageUploadRef
          .current(file, { mode: "imported-slide" })
          .then((result) => {
            if ("error" in result) return
            const updatedDoc = view.state.doc.toString()
            const change = replaceSlideBodyAtPosition(
              updatedDoc,
              insertAt,
              result.markdown,
            )
            view.dispatch({ changes: change })
            syncParentFromView(view.state.doc.toString())
          })
          .catch((err: unknown) => {
            console.error("imported-slide image upload failed", err)
          })
        return
      }

      const token = `uploading-${crypto.randomUUID()}`
      const placeholder = `![${token}]()\n`

      view.dispatch({
        changes: { from: insertAt, insert: placeholder },
      })
      syncParentFromView(view.state.doc.toString())

      onImageUploadRef
        .current(file, { mode: "inline" })
        .then((result) => {
          const current = view.state.doc.toString()
          const placeholderText = `![${token}]()`
          const placeholderStart = current.indexOf(placeholderText)

          if (placeholderStart === -1) return

          if ("error" in result) {
            removeUploadingPlaceholderView(view, token, syncParentFromView)
            return
          }
          const actualPlaceholder =
            placeholderText +
            (current[placeholderStart + placeholderText.length] === "\n"
              ? "\n"
              : "")
          view.dispatch({
            changes: {
              from: placeholderStart,
              to: placeholderStart + actualPlaceholder.length,
              insert: result.markdown + "\n",
            },
          })
          syncParentFromView(view.state.doc.toString())
        })
        .catch((err: unknown) => {
          console.error("inline image upload failed", err)
          removeUploadingPlaceholderView(view, token, syncParentFromView)
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
        ref={editorRef}
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
