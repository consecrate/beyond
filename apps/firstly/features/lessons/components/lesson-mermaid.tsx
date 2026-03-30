"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useTheme } from "next-themes"
import mermaid from "mermaid"

function sanitizeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "")
}

type Props = {
  source: string
}

/**
 * Renders a Mermaid diagram from source text (used for fenced ` ```mermaid ` blocks).
 */
export function LessonMermaid({ source }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reactId = useId()
  const graphId = `lm-${sanitizeId(reactId)}`
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.innerHTML = ""
    let cancelled = false

    const run = async () => {
      try {
        const trimmed = source.trim()
        if (!trimmed) return

        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          securityLevel: "loose",
        })
        const { svg, bindFunctions } = await mermaid.render(graphId, trimmed, el)
        if (cancelled) return
        el.innerHTML = svg
        bindFunctions?.(el)
        setError(null)
      } catch (e) {
        if (cancelled) return
        el.innerHTML = ""
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [source, graphId, resolvedTheme])

  if (!source.trim()) return null

  return (
    <div className="lesson-mermaid w-full min-w-0">
      <div
        ref={containerRef}
        className="[&_svg]:h-auto [&_svg]:max-w-full [&_svg]:min-w-0"
        aria-hidden={error ? true : undefined}
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
