"use client"

import { useEffect, useRef } from "react"
import { ImageDefinition } from "jazz-tools"
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
) {
  // Track object URLs for cleanup
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
          // Load ImageDefinition — resolves with full CoValue including progressive sizes
          const settled = await ImageDefinition.load(id, {
            resolve: { original: true },
          })

          if (cancelled) break
          // Settled<T> = T | Inaccessible<T>; guard on $isLoaded to narrow to T
          if (!settled || !settled.$isLoaded) {
            img.classList.add("jazz-image--failed")
            continue
          }

          // Now narrowed to the loaded ImageDefinition shape
          const imageDef = settled

          // Show blur placeholder immediately while full res loads
          if (imageDef.placeholderDataURL) {
            img.src = imageDef.placeholderDataURL
          }

          // Load best resolution for Reveal.js viewport (960×700)
          // Cast required: loadImageBySize expects ImageDefinition (type alias) not Settled<...>
          const result = await loadImageBySize(
            imageDef as unknown as import("jazz-tools").ImageDefinition,
            REVEAL_WIDTH,
            REVEAL_HEIGHT,
          )

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
      // Revoke all object URLs created in this cycle
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      objectUrlsRef.current = []
    }
  // Re-run when container contents change or me loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, me?.$isLoaded])
}
