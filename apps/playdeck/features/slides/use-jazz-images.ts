"use client"

import { useEffect, useRef } from "react"
import { loadImageBySize } from "jazz-tools/media"
import type { Loaded } from "jazz-tools"
import type { PlaydeckAccount } from "@/features/jazz/schema"

const REVEAL_WIDTH = 960
const REVEAL_HEIGHT = 700

/**
 * Resolves all `<img data-jazz-id="co_z...">` elements inside `containerRef`
 * to blob URLs using Jazz progressive image loading.
 *
 * Must be called in a "use client" component.
 * Safe to call on SSR — guards `typeof window === 'undefined'`.
 */
export function useJazzImages(
  containerRef: React.RefObject<HTMLElement | null>,
  me: Loaded<typeof PlaydeckAccount> | null | undefined,
  /**
   * Pass a content-derived key (e.g. the HTML string being rendered) so the
   * hook re-runs when the rendered HTML changes and new jazz images appear.
   */
  contentKey?: string,
) {
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!me?.$isLoaded) return

    const container = containerRef.current
    if (!container) return

    const elements = Array.from(
      container.querySelectorAll<HTMLImageElement>("img[data-jazz-id]"),
    )
    if (elements.length === 0) return

    let cancelled = false

    async function resolveImages() {
      for (const img of elements) {
        if (cancelled) break

        const id = img.dataset.jazzId
        if (!id) continue

        try {
          // loadImageBySize accepts a CoValue ID string directly —
          // no need to call ImageDefinition.load() first.
          const result = await loadImageBySize(id, REVEAL_WIDTH, REVEAL_HEIGHT)

          if (cancelled) break

          if (!result) {
            img.classList.add("jazz-image--failed")
            continue
          }

          const blob = result.image.toBlob()
          if (!blob) {
            img.classList.add("jazz-image--failed")
            continue
          }

          const url = URL.createObjectURL(blob)
          objectUrlsRef.current.push(url)
          img.src = url
          img.classList.remove("jazz-image--failed")
        } catch {
          if (!cancelled) {
            img.classList.add("jazz-image--failed")
          }
        }
      }
    }

    resolveImages()

    return () => {
      cancelled = true
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      objectUrlsRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, me?.$isLoaded, contentKey])
}
