"use client"

import { useEffect, type RefObject } from "react"

type UseRevealAutoLayoutArgs = {
  enabled: boolean
  contentRef: RefObject<HTMLElement | null>
  viewportRef?: RefObject<HTMLElement | null>
  onLayout: () => void
}

export function useRevealAutoLayout({
  enabled,
  contentRef,
  viewportRef,
  onLayout,
}: UseRevealAutoLayoutArgs) {
  useEffect(() => {
    if (!enabled) return

    const content = contentRef.current
    if (!content) return

    let rafA: number | null = null
    let rafB: number | null = null

    const cancelScheduledLayout = () => {
      if (rafA !== null) {
        cancelAnimationFrame(rafA)
        rafA = null
      }
      if (rafB !== null) {
        cancelAnimationFrame(rafB)
        rafB = null
      }
    }

    const scheduleLayout = () => {
      cancelScheduledLayout()
      rafA = requestAnimationFrame(() => {
        rafA = null
        rafB = requestAnimationFrame(() => {
          rafB = null
          onLayout()
        })
      })
    }

    scheduleLayout()

    const onAssetSettled = () => {
      scheduleLayout()
    }

    content.addEventListener("load", onAssetSettled, true)
    content.addEventListener("error", onAssetSettled, true)

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
          scheduleLayout()
        })
        : null
    mutationObserver?.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
          scheduleLayout()
        })
        : null
    if (viewportRef?.current) {
      resizeObserver?.observe(viewportRef.current)
    }

    const fontSet = typeof document !== "undefined" ? document.fonts : null
    const fontSetWithEvents = fontSet as
      | (FontFaceSet & {
        addEventListener?: (type: string, listener: EventListener) => void
        removeEventListener?: (type: string, listener: EventListener) => void
      })
      | null

    const onFontsSettled = () => {
      scheduleLayout()
    }

    fontSet?.ready.then(() => {
      scheduleLayout()
    }).catch(() => {})
    fontSetWithEvents?.addEventListener?.("loadingdone", onFontsSettled)
    fontSetWithEvents?.addEventListener?.("loadingerror", onFontsSettled)

    window.addEventListener("resize", onAssetSettled)
    window.addEventListener("orientationchange", onAssetSettled)

    return () => {
      cancelScheduledLayout()
      content.removeEventListener("load", onAssetSettled, true)
      content.removeEventListener("error", onAssetSettled, true)
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
      fontSetWithEvents?.removeEventListener?.("loadingdone", onFontsSettled)
      fontSetWithEvents?.removeEventListener?.("loadingerror", onFontsSettled)
      window.removeEventListener("resize", onAssetSettled)
      window.removeEventListener("orientationchange", onAssetSettled)
    }
  }, [contentRef, enabled, onLayout, viewportRef])
}
