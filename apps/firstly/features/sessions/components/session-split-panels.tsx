"use client"

import type { ReactNode } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@beyond/design-system"

type Props = {
  left: ReactNode
  right: ReactNode
  /** Pinned to the bottom of the left panel (e.g. chat); scroll stays in the main left area only. */
  leftFooter?: ReactNode
  className?: string
}

export function SessionSplitPanels({
  left,
  right,
  leftFooter,
  className,
}: Props) {
  const leftBody = leftFooter ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">{left}</div>
      {leftFooter}
    </div>
  ) : (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">{left}</div>
  )

  return (
    <Group
      id="session-split"
      defaultLayout={{ lessons: 40, detail: 60 }}
      orientation="horizontal"
      className={cn("flex h-full min-h-0 w-full min-w-0 flex-1", className)}
    >
      <Panel
        id="lessons"
        defaultSize={40}
        minSize={15}
        className="min-h-0 min-w-0"
      >
        {leftBody}
      </Panel>
      <Separator
        className={cn(
          "relative w-px max-w-px min-w-px shrink-0 cursor-col-resize touch-none bg-border px-0 transition-colors",
          "outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0",
          "hover:bg-muted-foreground/40",
          "data-[separator=hover]:bg-muted-foreground/45",
          "data-[separator=active]:bg-muted-foreground/55",
          "focus-visible:bg-muted-foreground/70",
        )}
      />
      <Panel
        id="detail"
        defaultSize={60}
        minSize={15}
        className="min-h-0 min-w-0"
      >
        <div className="h-full min-h-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
