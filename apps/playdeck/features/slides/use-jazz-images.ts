"use client"

import { useEffect, useRef } from "react"
import { loadImage } from "jazz-tools/media"
import type { Loaded } from "jazz-tools"
import type { PlaydeckAccount } from "@/features/jazz/schema"

/**
 * Resolves all `<img data-jazz-id="co_z...">` elements inside `containerRef`
 * to blob URLs using Jazz image loading.
 *
 * Must be called in a "use client" component.
 * Safe to call on SSR — guards `typeof window === 'undefined'`.
 */
export function useJazzImages(
  containerRef: React.RefObject<HTMLElement | null>,
  me: Loaded<typeof PlaydeckAccount> | null | undefined,
  /**
   * Pass a content-derived key (e.g. the HTML string or markdown) so the
   * hook re-runs when new jazz images appear in the rendered content.
   * Defaults to "" — always present so the dep array never changes size.
   */
  contentKey: string = "",
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
          // loadImage loads the ImageDefinition with resolve: { original: true }
          // then returns the original FileStream — works reliably for all images
          const result = await loadImage(id)

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
