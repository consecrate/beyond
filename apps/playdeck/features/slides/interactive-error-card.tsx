"use client"

import { cn } from "@beyond/design-system"

type Props = {
  title?: string
  message: string
  layout?: "card" | "overlay"
}

export function InteractiveErrorCard({
  title,
  message,
  layout = "card",
}: Props) {
  const overlay = layout === "overlay"

  return (
    <article
      className={cn(
        "w-full",
        overlay
          ? "max-w-lg px-0 py-0"
          : "max-w-4xl rounded-xl border border-border/80 bg-card/40 px-4 py-4",
      )}
    >
      <div
        className={cn(
          "rounded-3xl border border-destructive/35 bg-destructive/10 p-5",
          overlay && "px-6 py-6",
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive">
          Slide Error
        </p>
        {title ? (
          <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        ) : null}
        <p
          className={cn(
            "mt-3 leading-relaxed text-destructive",
            overlay ? "text-base" : "text-sm",
          )}
        >
          {message}
        </p>
      </div>
    </article>
  )
}
