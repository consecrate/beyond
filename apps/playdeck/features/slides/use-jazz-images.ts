"use client"

import { useEffect, useRef, useId } from "react"
import { ImageDefinition } from "jazz-tools"
import type { Loaded } from "jazz-tools"
import type { PlaydeckAccount } from "@/features/jazz/schema"

const PRESENTATION_IMAGE_MAX_WIDTH = 960

// Global cache to persist blob URLs across re-renders
const imageCache = new Map<string, { url: string; width: number }>()
// Track which component instance is responsible for each pending load
const pendingLoads = new Map<string, string>() // imageId -> instanceId

function revokeIfBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

/** Revokes all cached blob URLs and clears caches (e.g. tests or full reset). */
export function clearImageCache(): void {
  for (const { url } of imageCache.values()) {
    revokeIfBlobUrl(url)
  }
  imageCache.clear()
  pendingLoads.clear()
}

/** Apply cached URL to all matching img elements in the document */
function applyCachedUrl(id: string, url: string) {
  document.querySelectorAll<HTMLImageElement>(`img[data-jazz-id="${id}"]`).forEach((img) => {
    img.src = url
    img.classList.remove("jazz-image--failed")
    img.classList.remove("jazz-image--loading")
  })
}

function markLoadFailed(id: string) {
  document.querySelectorAll<HTMLImageElement>(`img[data-jazz-id="${id}"]`).forEach((img) => {
    img.classList.remove("jazz-image--loading")
    img.classList.add("jazz-image--failed")
  })
}

function cacheLoadedOriginal(
  id: string,
  imageDef: unknown,
): boolean {
  const original = (imageDef as {
    original?: { $isLoaded?: boolean; toBlob?: () => Blob | undefined }
    originalSize?: [number, number]
  }).original
  if (!original?.$isLoaded || typeof original.toBlob !== "function") return false

  const blob = original.toBlob()
  if (!blob) return false

  const url = URL.createObjectURL(blob)
  const width = Math.min(
    (imageDef as { originalSize?: [number, number] }).originalSize?.[0] ??
      PRESENTATION_IMAGE_MAX_WIDTH,
    PRESENTATION_IMAGE_MAX_WIDTH,
  )
  const prev = imageCache.get(id)
  if (prev) revokeIfBlobUrl(prev.url)
  imageCache.set(id, { url, width })
  applyCachedUrl(id, url)
  return true
}

/**
 * Resolves all `<img data-jazz-id="co_z...">` elements inside `containerRef`
 * to blob URLs using Jazz image loading.
 */
export function useJazzImages(
  containerRef: React.RefObject<HTMLElement | null>,
  me: Loaded<typeof PlaydeckAccount> | null | undefined,
  contentKey: string = "",
) {
  const instanceId = useId()
  const unsubscribesRef = useRef<Map<string, () => void>>(new Map())

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!me?.$isLoaded) return

    const container = containerRef.current
    if (!container) return

    const elements = Array.from(
      container.querySelectorAll<HTMLImageElement>("img[data-jazz-id]"),
    )
    if (elements.length === 0) return

    const idsWeStartedLoading: string[] = []

    for (const img of elements) {
      const id = img.dataset.jazzId
      if (!id) continue

      // If we already have this image cached, apply it
      const cached = imageCache.get(id)
      if (cached) {
        applyCachedUrl(id, cached.url)
        continue
      }

      // If another instance is loading, skip but don't mark as ours
      const loadingInstance = pendingLoads.get(id)
      if (loadingInstance && loadingInstance !== instanceId) continue

      // If we already have a subscription, skip
      if (unsubscribesRef.current.has(id)) continue

      // Mark this instance as responsible for this load
      pendingLoads.set(id, instanceId)
      idsWeStartedLoading.push(id)

      // Load as the current account so shared-reader permissions are respected.
      ImageDefinition.load(id, {
        as: me,
        resolve: { original: true },
      } as Parameters<typeof ImageDefinition.load>[1])
        .then((imageDef) => {
          // Check if we're still responsible (component might have unmounted)
          if (pendingLoads.get(id) !== instanceId) return

          if (!imageDef?.$isLoaded) {
            pendingLoads.delete(id)
            markLoadFailed(id)
            return
          }

          // Show placeholder immediately if available
          if (imageDef.placeholderDataURL && !imageCache.has(id)) {
            applyCachedUrl(id, imageDef.placeholderDataURL)
          }

          // If Jazz already resolved the original in the initial load, use it now.
          if (cacheLoadedOriginal(id, imageDef)) {
            pendingLoads.delete(id)
            return
          }

          // Subscribe to get the image when data syncs
          const unsubscribe = imageDef.$jazz.subscribe({}, () => {
            // Already cached? Done - unsubscribe
            if (imageCache.has(id)) {
              unsubscribe()
              unsubscribesRef.current.delete(id)
              return
            }

            // Check if we're still responsible
            if (pendingLoads.get(id) !== instanceId) return

            if (cacheLoadedOriginal(id, imageDef)) {
              pendingLoads.delete(id)
              unsubscribe()
              unsubscribesRef.current.delete(id)
            }
          })

          unsubscribesRef.current.set(id, unsubscribe)
        })
        .catch(() => {
          if (pendingLoads.get(id) === instanceId) {
            pendingLoads.delete(id)
            markLoadFailed(id)
          }
        })
    }

    // Cleanup: release pending loads we started when effect re-runs
    return () => {
      for (const id of idsWeStartedLoading) {
        if (pendingLoads.get(id) === instanceId) {
          pendingLoads.delete(id)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, me?.$isLoaded, contentKey, instanceId])

  // Cleanup subscriptions on unmount
  useEffect(() => {
    const currentInstanceId = instanceId
    return () => {
      for (const unsub of unsubscribesRef.current.values()) {
        unsub()
      }
      unsubscribesRef.current.clear()
      // Release any pending loads owned by this instance
      for (const [id, owner] of pendingLoads.entries()) {
        if (owner === currentInstanceId) {
          pendingLoads.delete(id)
        }
      }
    }
  }, [instanceId])
}
