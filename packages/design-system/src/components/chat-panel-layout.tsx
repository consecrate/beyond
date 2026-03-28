import type { ReactNode } from "react"

import { cn } from "../lib/utils"

export type ChatPanelLayoutProps = {
  /** Message list or other scrollable content. */
  children: ReactNode
  /** When `empty` is true, shown instead of `children` in the scroll region. */
  emptyState?: ReactNode
  empty?: boolean
  /** Optional banner above the footer (e.g. transport error). */
  error?: ReactNode
  /** Composer form or other pinned footer content. */
  footer: ReactNode
  className?: string
  scrollClassName?: string
}

/**
 * Column layout: scrollable transcript, optional error strip, pinned footer (e.g. composer).
 */
export function ChatPanelLayout({
  children,
  emptyState,
  empty = false,
  error,
  footer,
  className,
  scrollClassName,
}: ChatPanelLayoutProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-card",
        className,
      )}
    >
      <div
        className={cn(
          "min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3",
          scrollClassName,
        )}
        aria-live="polite"
      >
        {empty && emptyState ? emptyState : children}
      </div>

      {error ? (
        <div
          className="border-t border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {footer}
    </div>
  )
}
