"use client"

/* eslint-disable react-hooks/set-state-in-effect -- resolve IndexedDB / image src in effects; state mirrors async external store */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import {
  getImportedSlideRecord,
  preloadImportedSlideSrc,
  subscribeToImportedSlideChanges,
} from "@/features/decks/local-imported-slide-store"
import {
  isLocalImportedSlideSource,
  parseLocalImportedSlideId,
} from "@/features/decks/parse-slide-import"
import { cn } from "@beyond/design-system"
import { AlertCircle, ImageIcon, Loader2 } from "lucide-react"

type ImportedSlideAvailability =
  | "empty"
  | "loading"
  | "ready"
  | "pending"
  | "failed"
  | "unavailable"

type ImportedSlideResolvedState = {
  availability: ImportedSlideAvailability
  src: string | null
  uploadState: "idle" | "pending" | "failed"
  message: string | null
}

type ImportedSlideFitMode = "contain" | "soft-cover" | "hybrid"

const SLIDE_ASPECT_RATIO = 960 / 700

function useImportedSlideSource(source: string | null | undefined) {
  const [state, setState] = useState<ImportedSlideResolvedState>({
    availability: source ? "loading" : "empty",
    src: null,
    uploadState: "idle",
    message: null,
  })

  useEffect(() => {
    if (!source) {
      setState({
        availability: "empty",
        src: null,
        uploadState: "idle",
        message: null,
      })
      return
    }

    if (!isLocalImportedSlideSource(source)) {
      setState({
        availability: "ready",
        src: source,
        uploadState: "idle",
        message: null,
      })
      return
    }

    const importId = parseLocalImportedSlideId(source)
    if (!importId) {
      setState({
        availability: "unavailable",
        src: null,
        uploadState: "idle",
        message: "Imported slide source is invalid.",
      })
      return
    }

    let active = true
    let objectUrl: string | null = null

    const resolve = async () => {
      setState((current) => ({
        ...current,
        availability: "loading",
        src: null,
      }))

      const record = await getImportedSlideRecord(importId)
      if (!active) return

      if (!record) {
        setState({
          availability: "unavailable",
          src: null,
          uploadState: "idle",
          message:
            "This imported slide is only available on the presenter device until upload finishes.",
        })
        return
      }

      if (record.blob) {
        objectUrl = URL.createObjectURL(record.blob)
        setState({
          availability: "ready",
          src: objectUrl,
          uploadState:
            record.remoteUrl != null || record.status === "uploaded"
              ? "idle"
              : record.status === "failed"
                ? "failed"
                : "pending",
          message: record.lastError,
        })
        return
      }

      if (record.remoteUrl) {
        setState({
          availability: "ready",
          src: record.remoteUrl,
          uploadState: "idle",
          message: null,
        })
        return
      }

      setState({
        availability: record.status === "failed" ? "failed" : "pending",
        src: null,
        uploadState: record.status === "failed" ? "failed" : "pending",
        message:
          record.lastError ??
          "Imported slide is still uploading from the presenter device.",
      })
    }

    void resolve()
    const unsubscribe = subscribeToImportedSlideChanges((changedId) => {
      if (changedId === importId) {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = null
        }
        void resolve()
      }
    })

    return () => {
      active = false
      unsubscribe()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [source])

  return state
}

export function useImportedSlidePrefetch(
  slides: RevealSlideModel[],
  activeIndex: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    const upcoming = slides
      .slice(Math.max(0, activeIndex))
      .map((slide) => slide.importedImage?.src ?? null)
      .filter((src): src is string => typeof src === "string" && src !== "")

    if (upcoming.length === 0) return

    let cancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null

    void preloadImportedSlideSrc(upcoming[0]!)

    const schedule = (callback: () => void) => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(() => callback())
        return
      }
      timeoutHandle = globalThis.setTimeout(callback, 250)
    }

    const cancelScheduled = () => {
      if (
        idleHandle != null &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleHandle)
        idleHandle = null
      }
      if (timeoutHandle != null) {
        globalThis.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
    }

    const preloadRest = (index: number) => {
      if (cancelled || index >= upcoming.length) return
      schedule(() => {
        if (cancelled) return
        void preloadImportedSlideSrc(upcoming[index]!).finally(() => {
          preloadRest(index + 1)
        })
      })
    }

    preloadRest(1)

    return () => {
      cancelled = true
      cancelScheduled()
    }
  }, [activeIndex, enabled, slides])
}

type ImportedSlideFrameProps = {
  source: string | null
  title?: string
  priority?: boolean
  className?: string
}

function ImportedSlideStatus({
  icon,
  title,
  message,
  tone = "muted",
}: {
  icon: ReactNode
  title: string
  message: string
  tone?: "muted" | "warning" | "danger"
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-3xl border px-6 py-8 text-center",
        tone === "muted" &&
          "border-border/60 bg-card/55 text-muted-foreground",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-100",
        tone === "danger" &&
          "border-destructive/35 bg-destructive/10 text-destructive",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-current/20 bg-background/35">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

function applyLoadedFromImage(
  img: HTMLImageElement,
  setters: {
    setImageError: (v: boolean) => void
    setImageLoaded: (v: boolean) => void
    setImageSize: (v: { width: number; height: number } | null) => void
  },
) {
  if (!img.complete || img.naturalWidth < 1) return false
  setters.setImageError(false)
  setters.setImageLoaded(true)
  setters.setImageSize({
    width: img.naturalWidth,
    height: img.naturalHeight,
  })
  return true
}

export function ImportedSlideFrame({
  source,
  title,
  priority = false,
  className,
}: ImportedSlideFrameProps) {
  const resolved = useImportedSlideSource(source)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const foregroundImgRef = useRef<HTMLImageElement | null>(null)

  /** Reset on src change and sync from DOM when the image is already decoded (cached/blob). Must run in layout phase so a later useEffect reset cannot wipe a correct loaded state. */
  useLayoutEffect(() => {
    setImageLoaded(false)
    setImageError(false)
    setImageSize(null)

    const img = foregroundImgRef.current
    if (!img || !resolved.src) return

    const setters = {
      setImageError,
      setImageLoaded,
      setImageSize,
    }

    const trySync = () => {
      if (applyLoadedFromImage(img, setters)) return
      if (typeof img.decode === "function") {
        void img
          .decode()
          .then(() => {
            applyLoadedFromImage(img, setters)
          })
          .catch(() => {
            /* decode can reject; onLoad/onError still apply */
          })
      }
    }

    trySync()
    const raf = requestAnimationFrame(() => {
      trySync()
    })
    return () => cancelAnimationFrame(raf)
  }, [resolved.src])

  const fitMode = useMemo<ImportedSlideFitMode>(() => {
    if (!imageSize || imageSize.width < 1 || imageSize.height < 1) {
      return "contain"
    }
    const imageAspect = imageSize.width / imageSize.height
    const relativeDelta = Math.abs(imageAspect - SLIDE_ASPECT_RATIO) / SLIDE_ASPECT_RATIO

    if (relativeDelta <= 0.12) {
      return "soft-cover"
    }
    if (relativeDelta <= 0.5) {
      return "hybrid"
    }
    return "contain"
  }, [imageSize])

  const foregroundFrameClassName = useMemo(
    () =>
      cn(
        "relative z-20 flex h-full w-full items-center justify-center overflow-hidden transition-all duration-300",
      ),
    [],
  )

  const imageClassName = useMemo(
    () =>
      cn(
        "transition-all duration-300 h-full w-full",
        imageLoaded ? "opacity-100" : "opacity-0",
        fitMode === "soft-cover" && "object-cover",
        fitMode === "hybrid" && "object-contain",
        fitMode === "contain" && "object-contain",
      ),
    [fitMode, imageLoaded],
  )

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        className,
      )}
    >
      {resolved.availability === "empty" ? (
        <ImportedSlideStatus
          icon={<ImageIcon className="h-5 w-5" />}
          title={title?.trim() || "Import Slide"}
          message="This slide is ready for `#import` or `#image`. Paste or drop one image to fill the whole slide."
        />
      ) : null}

      {resolved.availability === "loading" ? (
        <ImportedSlideStatus
          icon={<Loader2 className="h-5 w-5 animate-spin" />}
          title="Preparing slide image"
          message="Loading the imported slide asset."
        />
      ) : null}

      {resolved.availability === "pending" ? (
        <ImportedSlideStatus
          icon={<Loader2 className="h-5 w-5 animate-spin" />}
          title="Waiting for upload"
          message={
            resolved.message ??
            "This imported slide is still syncing from the presenter device."
          }
          tone="warning"
        />
      ) : null}

      {resolved.availability === "failed" ? (
        <ImportedSlideStatus
          icon={<AlertCircle className="h-5 w-5" />}
          title="Upload needs another try"
          message={
            resolved.message ??
            "The imported slide is still local to the presenter device."
          }
          tone="danger"
        />
      ) : null}

      {resolved.availability === "unavailable" ? (
        <ImportedSlideStatus
          icon={<AlertCircle className="h-5 w-5" />}
          title="Imported slide not available here"
          message={
            resolved.message ??
            "This imported slide has not finished uploading yet."
          }
          tone="warning"
        />
      ) : null}

      {resolved.src ? (
        <>
          <img
            src={resolved.src}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl saturate-125"
          />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_18%,rgba(13,17,23,0.16)_56%,rgba(13,17,23,0.58)_100%)]" />
          {!imageLoaded && !imageError ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/55" />
            </div>
          ) : null}
          <div className={foregroundFrameClassName}>
            {imageError ? (
              <div className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/70">
                <AlertCircle className="h-8 w-8 text-amber-400/90" aria-hidden />
                <span>Could not load slide image</span>
              </div>
            ) : (
              <img
                ref={foregroundImgRef}
                src={resolved.src}
                alt={title?.trim() || "Imported slide"}
                className={imageClassName}
                loading="eager"
                decoding="async"
                fetchPriority={priority ? "high" : "auto"}
                onLoad={(event) => {
                  const el = event.currentTarget
                  setImageError(false)
                  setImageLoaded(true)
                  setImageSize({
                    width: el.naturalWidth,
                    height: el.naturalHeight,
                  })
                }}
                onError={() => {
                  setImageError(true)
                  setImageLoaded(true)
                  setImageSize(null)
                }}
              />
            )}
          </div>
          {resolved.uploadState === "pending" ? (
            <div className="absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              Syncing…
            </div>
          ) : null}
          {resolved.uploadState === "failed" ? (
            <div className="absolute right-4 top-4 z-30 rounded-full border border-destructive/35 bg-destructive/20 px-3 py-1 text-xs font-medium text-destructive-foreground backdrop-blur">
              Local only
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
