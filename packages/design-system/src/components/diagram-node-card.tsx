import type { ReactNode } from "react"

import { cn } from "../lib/utils"

export type DiagramNodeCardProps = {
  children: ReactNode
  className?: string
}

/**
 * Default chrome for a flow-graph node (border, card background, centered label text).
 */
export function DiagramNodeCard({ children, className }: DiagramNodeCardProps) {
  return (
    <div
      className={cn(
        "min-w-[140px] rounded-sm border border-border bg-card px-3 py-2 text-center text-sm text-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}
