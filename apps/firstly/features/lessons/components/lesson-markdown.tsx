"use client"

import "katex/dist/katex.min.css"

import { Children, isValidElement } from "react"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { cn } from "@beyond/design-system"

import { LessonMermaid } from "@/features/lessons/components/lesson-mermaid"

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeKatex]

function createMarkdownComponents(allowMermaid: boolean): Components {
  return {
    code: ({ className, children, ...props }) => {
      if (allowMermaid && className?.includes("language-mermaid")) {
        const text = String(children).replace(/\n$/, "")
        return <LessonMermaid source={text} />
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => {
      if (!allowMermaid) {
        return <pre>{children}</pre>
      }
      if (Children.count(children) === 1) {
        const only = Children.only(children)
        if (isValidElement(only) && only.type === LessonMermaid) {
          return (
            <div className="my-3 overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-3">
              {only}
            </div>
          )
        }
      }
      return <pre>{children}</pre>
    },
  }
}

/** Phrasing-only wrapper so math + text are valid inside `<h1>`–`<h6>`. */
const inlineComponents: Components = {
  p: ({ children }) => <span className="inline leading-[inherit]">{children}</span>,
  ...createMarkdownComponents(false),
}

const blockComponents = createMarkdownComponents(true)

type Props = {
  markdown: string
  className?: string
  /**
   * `inline`: span root + `<p>` → `<span>` for use inside headings (math + GFM).
   * Default block layout uses a `div` root.
   */
  variant?: "default" | "inline"
}

/**
 * Renders Markdown with GFM, TeX math (`$...$`, `$$...$$`) via KaTeX, and fenced ` ```mermaid ` diagrams.
 */
export function LessonMarkdown({ markdown, className, variant = "default" }: Props) {
  if (!markdown.trim()) return null

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "lesson-markdown lesson-markdown-inline min-w-0 text-inherit",
          "[&_.katex]:text-[0.95em] [&_.katex-display]:my-1 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto",
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={inlineComponents}
        >
          {markdown}
        </ReactMarkdown>
      </span>
    )
  }

  return (
    <div
      className={cn(
        "lesson-markdown max-w-prose text-sm leading-relaxed text-foreground",
        "[&_h1]:font-display [&_h1]:text-xl [&_h1]:font-medium [&_h1]:tracking-tight [&_h1]:mt-6 [&_h1]:mb-3 first:[&_h1]:mt-0",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5",
        "[&_p]:mb-3 [&_p]:leading-relaxed",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:leading-relaxed",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:text-xs",
        "[&_p_code]:rounded [&_p_code]:bg-muted/50 [&_p_code]:px-1 [&_p_code]:py-0.5 [&_p_code]:text-xs",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:mb-3 [&_table]:w-full [&_table]:text-sm",
        "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        "[&_.katex-display]:my-4 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={blockComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
