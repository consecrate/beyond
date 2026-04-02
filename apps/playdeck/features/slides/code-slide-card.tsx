"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import type { CodeBlock } from "@/features/decks/parse-slide-code"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import { cn } from "@beyond/design-system"

export type CodeSlideCardLayout = "card" | "overlay"

export type CodeSlideCardProps = {
  block: CodeBlock
  layout?: CodeSlideCardLayout
}

export function CodeSlideCard({ block, layout = "card" }: CodeSlideCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(block.rawCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const overlay = layout === "overlay"

  return (
    <article
      className={cn(
        "w-full overflow-hidden border bg-zinc-950 shadow-2xl",
        overlay ? "max-w-4xl rounded-xl border-zinc-800" : "max-w-full rounded-md border-zinc-800",
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <div className="flex items-center gap-2">
          {/* macOS-style window controls */}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          {block.language && (
            <span className="ml-2 font-mono text-xs font-medium text-zinc-400">
              {block.language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <div
        className={cn(
          "w-full overflow-auto bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300",
          overlay ? "max-h-[60vh] p-6 text-base" : "max-h-[300px]",
          // Remove default reveal.js presentation text sizes/margins from inside the block
          "[&_.slide-codeblock-pre]:!m-0 [&_.slide-codeblock-pre]:!bg-transparent [&_.slide-codeblock-pre]:!shadow-none [&_.slide-codeblock-header]:hidden",
        )}
        dangerouslySetInnerHTML={{
          __html: slideMarkdownToSafeHtml(block.rawMarkdown),
        }}
      />
    </article>
  )
}
