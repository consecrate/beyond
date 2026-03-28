import type { ReactNode } from "react"

import { cn } from "../lib/utils"

export type DiagramCanvasProps = {
  children: ReactNode
  className?: string
}

/**
 * Full-area surface for diagrams (React Flow, etc.): subtle muted backdrop.
 */
export function DiagramCanvas({ children, className }: DiagramCanvasProps) {
  return (
    <div className={cn("h-full min-h-[240px] w-full bg-muted/10", className)}>
      {children}
    </div>
  )
}
