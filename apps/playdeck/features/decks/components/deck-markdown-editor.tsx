"use client"

import { markdown } from "@codemirror/lang-markdown"
import { useTheme } from "next-themes"
import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { githubDark, githubLight } from "@uiw/codemirror-theme-github"

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
    () => [markdown(), themeExt],
    [themeExt],
  )

  return (
    <div className={className}>
      <CodeMirror
        theme="none"
        value={value}
        height="100%"
        className="min-h-0 flex-1 overflow-hidden [&_.cm-editor]:min-h-[260px] [&_.cm-editor]:h-full [&_.cm-scroller]:min-h-[260px]"
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
