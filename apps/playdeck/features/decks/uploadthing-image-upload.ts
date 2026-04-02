"use client"

import { uploadFiles } from "@/lib/uploadthing/client"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type UploadProfile = "inline" | "imported-slide"

const PROFILE_SETTINGS: Record<
  UploadProfile,
  {
    targetBytes: number
    qualitySteps: number[]
    maxEdge: number
  }
> = {
  inline: {
    targetBytes: 2 * 1024 * 1024,
    qualitySteps: [0.86, 0.78, 0.7, 0.62],
    maxEdge: 1920,
  },
  "imported-slide": {
    targetBytes: 3 * 1024 * 1024,
    qualitySteps: [0.92, 0.88, 0.82, 0.76],
    maxEdge: 2048,
  },
}

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

type RasterSource = {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

function extensionForBlob(blob: Blob): string | null {
  return MIME_TO_EXTENSION[blob.type] ?? null
}

function targetDimensions(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: scale < 1,
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

async function loadRasterSource(blob: Blob): Promise<RasterSource | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Fall back to Image decoding below.
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = "async"
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Could not decode image."))
      image.src = objectUrl
    })

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    }
  } catch {
    URL.revokeObjectURL(objectUrl)
    return null
  }
}

async function optimizeImageForSlide(
  blob: Blob,
  profile: UploadProfile,
): Promise<Blob> {
  if (blob.type === "image/gif") return blob
  if (typeof document === "undefined") return blob

  const raster = await loadRasterSource(blob)
  if (!raster) return blob

  try {
    const settings = PROFILE_SETTINGS[profile]
    const { width, height, resized } = targetDimensions(
      raster.width,
      raster.height,
      settings.maxEdge,
    )
    const shouldOptimize = resized || blob.size > settings.targetBytes
    if (!shouldOptimize) return blob

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return blob

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(raster.source, 0, 0, width, height)

    let smallestCandidate: Blob | null = null
    const targetBytes = Math.min(blob.size, settings.targetBytes)

    for (const quality of settings.qualitySteps) {
      const candidate = await canvasToBlob(canvas, "image/webp", quality)
      if (!candidate) continue

      if (!smallestCandidate || candidate.size < smallestCandidate.size) {
        smallestCandidate = candidate
      }

      if (candidate.size <= targetBytes) {
        return candidate
      }
    }

    return smallestCandidate && smallestCandidate.size < blob.size
      ? smallestCandidate
      : blob
  } finally {
    raster.dispose()
  }
}

/**
 * Uploads an optimized slide image via UploadThing. Same contract as the former Supabase helper.
 */
export async function uploadSlideImage(
  blob: Blob,
  options?: { profile?: UploadProfile },
): Promise<{ url: string } | { error: string }> {
  try {
    const profile = options?.profile ?? "inline"
    const optimizedBlob = await optimizeImageForSlide(blob, profile)
    const ext = extensionForBlob(optimizedBlob)
    if (!ext) {
      return { error: "Only PNG, JPG, WEBP, and GIF images are supported." }
    }

    if (optimizedBlob.size > MAX_IMAGE_BYTES) {
      return { error: "Images must be 5 MB or smaller." }
    }

    const name = `slides/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const file = new File([optimizedBlob], name, {
      type: optimizedBlob.type || `image/${ext}`,
    })

    const uploaded = await uploadFiles("slideImage", {
      files: [file],
    })

    const first = uploaded[0]
    if (!first?.url) {
      return { error: "Could not resolve uploaded image URL." }
    }

    return { url: first.url }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Upload failed",
    }
  }
}
