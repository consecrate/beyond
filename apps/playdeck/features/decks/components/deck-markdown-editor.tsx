"use client"

import { markdown } from "@codemirror/lang-markdown"
import { EditorView } from "@codemirror/view"
import { useTheme } from "next-themes"
import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"

import { cn } from "@beyond/design-system"

import { markdownFormattingKeymap } from "@/features/decks/codemirror-markdown-formatting"

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function DeckMarkdownEditor({ value, onChange, className }: Props) {
  const { resolvedTheme } = useTheme()
  const themeExt = useMemo(
    () => (resolvedTheme === "dark" ? githubDark : githubLight),
    [resolvedTheme],
  )

  const extensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, themeExt, markdownFormattingKeymap],
    [themeExt],
  )

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
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
