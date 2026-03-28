"use client"

import type { ReactNode } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "../lib/utils"

export type ResizableSplitLayoutProps = {
  /** Typically a sidebar (chat, nav, etc.). */
  left: ReactNode
  /** Typically a main canvas or detail pane. */
  right: ReactNode
  /** When set, the left panel body scrolls above this pinned region (e.g. chat transcript + composer). */
  leftFooter?: ReactNode
  className?: string
  groupId?: string
  leftPanelId?: string
  rightPanelId?: string
  /** Percentage widths; keys must match `leftPanelId` and `rightPanelId`. */
  defaultLayout?: Record<string, number>
  leftDefaultSize?: number
  rightDefaultSize?: number
  leftMinSize?: number
  rightMinSize?: number
}

/**
 * Two-column horizontal split with a draggable separator (react-resizable-panels).
 */
export function ResizableSplitLayout({
  left,
  right,
  leftFooter,
  className,
  groupId = "split-layout",
  leftPanelId = "left",
  rightPanelId = "right",
  defaultLayout,
  leftDefaultSize = 40,
  rightDefaultSize = 60,
  leftMinSize = 15,
  rightMinSize = 15,
}: ResizableSplitLayoutProps) {
  const layout =
    defaultLayout ??
    ({
      [leftPanelId]: leftDefaultSize,
      [rightPanelId]: rightDefaultSize,
    } as Record<string, number>)

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
      id={groupId}
      defaultLayout={layout}
      orientation="horizontal"
      className={cn("flex h-full min-h-0 w-full min-w-0 flex-1", className)}
    >
      <Panel
        id={leftPanelId}
        defaultSize={leftDefaultSize}
        minSize={leftMinSize}
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
        id={rightPanelId}
        defaultSize={rightDefaultSize}
        minSize={rightMinSize}
        className="min-h-0 min-w-0"
      >
        <div className="h-full min-h-0 overflow-hidden">{right}</div>
      </Panel>
    </Group>
  )
}
