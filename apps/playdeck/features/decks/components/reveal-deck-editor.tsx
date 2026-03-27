"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"

import "reveal.js/reset.css"
import "reveal.js/reveal.css"
import "reveal.js/theme/white.css"

import type { SlideRow } from "@/features/decks/queries"
import {
  createDeckReveal,
  buildSlidesInnerHtml,
  extractSlidePayload,
  getSlideIdFromElement,
} from "@/lib/reveal"
import {
  createSlide,
  deleteDeckSlide,
  moveDeckSlide,
  updateSlideFields,
} from "@/features/decks/slides"
import { Button, cn, Textarea } from "@beyond/design-system"

type Props = {
  deckId: string
  deckTitle: string
  slides: SlideRow[]
}

const SAVE_DEBOUNCE_MS = 600

function useDebouncedCallback<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: T) => {
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => {
        t.current = null
        fn(...args)
      }, delay)
    },
    [fn, delay],
  )
}

export function RevealDeckEditor({ deckId, deckTitle, slides }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const structureKey = useMemo(() => slides.map((s) => s.id).join(","), [slides])

  const revealRootRef = useRef<HTMLDivElement>(null)
  const slidesContainerRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<Awaited<ReturnType<typeof createDeckReveal>> | null>(
    null,
  )
  const activeIndexRef = useRef(0)

  const [activeIndex, setActiveIndex] = useState(0)
  const [notesText, setNotesText] = useState(() => slides[0]?.speaker_notes ?? "")

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  const slidesRef = useRef(slides)
  useEffect(() => {
    slidesRef.current = slides
  }, [slides])

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const displayIndex =
    slides.length === 0 ? 0 : Math.min(activeIndex, slides.length - 1)
  const activeSlide = slides[displayIndex]
  const activeId = activeSlide?.id

  const notesTextRef = useRef(notesText)
  const activeIdRef = useRef(activeId)
  useEffect(() => {
    notesTextRef.current = notesText
  }, [notesText])
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const persistSlide = useCallback(
    async (
      slideId: string,
      payload: { title: string; body: string; speakerNotes: string | null },
    ) => {
      setSaveState("saving")
      setSaveError(null)
      const result = await updateSlideFields({
        deckId,
        slideId,
        title: payload.title,
        body: payload.body,
        speakerNotes: payload.speakerNotes,
      })
      if (result.error) {
        setSaveState("error")
        setSaveError(result.error)
        return
      }
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    },
    [deckId],
  )

  const debouncedPersistSlide = useDebouncedCallback(persistSlide, SAVE_DEBOUNCE_MS)

  const flushSaveFromDom = useCallback(
    (slideId: string) => {
      const root = slidesContainerRef.current
      if (!root) return
      const section = root.querySelector<HTMLElement>(
        `section[data-slide-id="${slideId}"]`,
      )
      if (!section) return
      const payload = extractSlidePayload(section)
      if (!payload) return
      const sn =
        slideId === activeIdRef.current
          ? notesTextRef.current.trim()
            ? notesTextRef.current
            : null
          : slidesRef.current.find((s) => s.id === slideId)?.speaker_notes ??
            null
      void persistSlide(slideId, {
        title: payload.title,
        body: payload.body,
        speakerNotes: sn?.trim() ? sn : null,
      })
    },
    [persistSlide],
  )

  const debouncedFlushDom = useDebouncedCallback(flushSaveFromDom, SAVE_DEBOUNCE_MS)

  const onSlidesInput = useCallback(
    (e: Event) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (
        !target.classList.contains("deck-slide-title") &&
        !target.classList.contains("deck-slide-body")
      ) {
        return
      }
      const id = getSlideIdFromElement(target)
      if (!id) return
      debouncedFlushDom(id)
    },
    [debouncedFlushDom],
  )

  useEffect(() => {
    if (slides.length === 0) {
      deckRef.current?.destroy()
      deckRef.current = null
      return
    }

    const revealRoot = revealRootRef.current
    const slidesContainer = slidesContainerRef.current
    if (!revealRoot || !slidesContainer) return

    slidesContainer.innerHTML = buildSlidesInnerHtml(slides)

    let cancelled = false
    let deckInstance: Awaited<ReturnType<typeof createDeckReveal>> | null =
      null

    const onSlideChanged = () => {
      const d = deckInstance
      if (!d) return
      const { h } = d.getIndices()
      setActiveIndex(h)
      const row = slidesRef.current[h]
      setNotesText(row?.speaker_notes ?? "")
    }

    void createDeckReveal(revealRoot, {
      embedded: true,
      keyboardCondition: "focused",
      hash: false,
      controls: true,
      progress: true,
      slideNumber: true,
    }).then((d) => {
      if (cancelled) {
        d.destroy()
        return
      }
      deckInstance = d
      deckRef.current = d
      d.on("slidechanged", onSlideChanged)
      slidesContainer.addEventListener("input", onSlidesInput)

      const startIdx = Math.min(
        activeIndexRef.current,
        slides.length - 1,
      )
      d.slide(startIdx, 0)
    })

    return () => {
      cancelled = true
      slidesContainer.removeEventListener("input", onSlidesInput)
      if (deckInstance) {
        deckInstance.off("slidechanged", onSlideChanged)
        deckInstance.destroy()
        deckInstance = null
      }
      deckRef.current = null
    }
  }, [deckId, structureKey, slides, onSlidesInput])

  const onNotesChange = (value: string) => {
    if (!activeId) return
    setNotesText(value)

    const root = slidesContainerRef.current
    const section = root?.querySelector<HTMLElement>(
      `section[data-slide-id="${activeId}"]`,
    )
    if (!section) return
    const payload = extractSlidePayload(section)
    if (!payload) return
    debouncedPersistSlide(activeId, {
      title: payload.title,
      body: payload.body,
      speakerNotes: value.trim() ? value : null,
    })
  }

  const refreshSlides = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const handleAddSlide = async () => {
    const r = await createSlide(deckId)
    if (r.error) {
      setSaveError(r.error)
      return
    }
    refreshSlides()
  }

  const handleDeleteSlide = async () => {
    if (!activeId || slides.length === 0) return
    if (!confirm("Delete this slide?")) return
    const r = await deleteDeckSlide(deckId, activeId)
    if (r.error) {
      setSaveError(r.error)
      return
    }
    refreshSlides()
  }

  const handleMove = async (direction: "up" | "down") => {
    if (!activeId) return
    const r = await moveDeckSlide(deckId, activeId, direction)
    if (r.error) {
      setSaveError(r.error)
      return
    }
    refreshSlides()
  }

  const goToSlide = (index: number) => {
    deckRef.current?.slide(index, 0)
    setActiveIndex(index)
    setNotesText(slides[index]?.speaker_notes ?? "")
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 md:px-5">
        <Link
          href={`/presenter/decks/${deckId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Deck settings
        </Link>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <h1 className="min-w-0 truncate font-heading text-base font-semibold tracking-tight md:text-lg">
          {deckTitle}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
          {saveState === "error" && saveError && (
            <span className="max-w-[12rem] truncate text-xs text-destructive">
              {saveError}
            </span>
          )}
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </header>

      {slides.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">No slides yet.</p>
          <Button type="button" onClick={() => void handleAddSlide()}>
            <Plus className="mr-2 h-4 w-4" />
            Add first slide
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex shrink-0 gap-2 border-b border-border p-3 lg:w-44 lg:flex-col lg:border-r lg:border-b-0 lg:overflow-y-auto">
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "flex min-h-14 min-w-20 flex-col items-start justify-center rounded-md border px-2 py-2 text-left text-xs transition-colors lg:min-h-0 lg:w-full lg:flex-row lg:items-center lg:gap-2",
                    i === displayIndex
                      ? "border-foreground bg-muted"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  <span className="font-medium tabular-nums">{i + 1}</span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {s.title.trim() || "Untitled"}
                  </span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1 lg:ml-0 lg:flex-col lg:pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="lg:w-full"
                onClick={() => void handleAddSlide()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="lg:w-full"
                disabled={displayIndex <= 0}
                onClick={() => void handleMove("up")}
              >
                <ChevronUp className="mr-1 h-3.5 w-3.5" />
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="lg:w-full"
                disabled={displayIndex >= slides.length - 1}
                onClick={() => void handleMove("down")}
              >
                <ChevronDown className="mr-1 h-3.5 w-3.5" />
                Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="lg:w-full"
                onClick={() => void handleDeleteSlide()}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </aside>

          <div
            className="deck-reveal-editor relative min-h-[min(50vh,420px)] min-w-0 flex-1 overflow-hidden bg-muted/30 p-4 focus:outline-none lg:min-h-0"
            tabIndex={0}
          >
            <div
              ref={revealRootRef}
              className="reveal h-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div ref={slidesContainerRef} className="slides" />
            </div>
          </div>

          <aside className="shrink-0 border-t border-border p-4 lg:w-72 lg:border-t-0 lg:border-l">
            <label
              htmlFor="speaker-notes"
              className="mb-2 block text-sm font-medium"
            >
              Speaker notes
              <span className="font-normal text-muted-foreground">
                {" "}
                (optional)
              </span>
            </label>
            <Textarea
              id="speaker-notes"
              value={notesText}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                onNotesChange(e.target.value)
              }
              placeholder="Notes for this slide…"
              rows={8}
              className="resize-y text-sm"
            />
          </aside>
        </div>
      )}
    </div>
  )
}
