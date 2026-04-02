"use client"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { replaceSlidesFromMarkdown } from "@/features/decks/jazz-deck-mutations"
import {
  createLocalImportedSlideRecord,
  ensureImportedSlideUploaded,
  getImportedSlideRecord,
  subscribeToImportedSlideChanges,
} from "@/features/decks/local-imported-slide-store"
import {
  buildImportedSlideDirective,
  extractLocalImportedSlideIds,
  replaceImportedSlideSource,
} from "@/features/decks/parse-slide-import"
import type { DeckSlideView } from "@/features/decks/deck-types"
import { uploadSlideImage } from "@/features/decks/uploadthing-image-upload"
import { appendPollSlideMarkdown } from "@/features/decks/parse-slide-poll"
import {
  appendQuestionSlideMarkdown,
  appendBattleRoyaleMarkdown,
} from "@/features/decks/parse-slide-question"
import type { ImageUploadFn } from "@/features/decks/codemirror-image-paste"
import { hasPendingImageUpload } from "@/features/decks/codemirror-image-paste"
import {
  deckSlidesToRevealModels,
  markdownMatchesSlides,
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import { DeckMarkdownEditor } from "@/features/decks/components/deck-markdown-editor"
import { extractJazzImageIds } from "@/features/slides/jazz-image-ids"
import { DeckRevealPreview } from "@/features/slides/deck-reveal-preview"
import { Button } from "@beyond/design-system"

const AUTOSAVE_MS = 600

function initialMarkdown(slides: DeckSlideView[]): string {
  if (slides.length === 0) return "# Slide\n\n"
  return slidesToMarkdownDocument(slides)
}

type Props = {
  deckId: string
  slides: DeckSlideView[]
  onEditorStateChange?: (state: {
    isDirty: boolean
    hasPendingUploads: boolean
    isSaving: boolean
  }) => void
}

export function DeckEditorWorkspace({
  deckId,
  slides,
  onEditorStateChange,
}: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: { root: { decks: { $each: { slides: { $each: true } } } } },
  })
  const [markdown, setMarkdown] = useState(() => initialMarkdown(slides))
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState(() =>
    initialMarkdown(slides),
  )
  const [error, setError] = useState<string | undefined>()
  const [pendingImportedUploads, setPendingImportedUploads] = useState(0)
  const [pending, startSaveTransition] = useTransition()

  const markdownRef = useRef(markdown)
  const lastSavedRef = useRef(lastSavedMarkdown)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const meRef = useRef(me)
  /* eslint-disable react-hooks/refs -- sync refs during render avoids autosave / image-upload races */
  meRef.current = me
  // Sync refs immediately (not in effect) to avoid race conditions
  markdownRef.current = markdown
  lastSavedRef.current = lastSavedMarkdown
  /* eslint-enable react-hooks/refs */

  const slidesSyncKey = useMemo(
    () =>
      slides
        .map((s) => `${s.id}\t${s.updated_at}\t${s.title}\t${s.body}`)
        .join("\n"),
    [slides],
  )

  // External sync: only apply if local is clean and content actually differs
  useEffect(() => {
    // Only sync from server if we haven't made local changes
    if (markdown !== lastSavedMarkdown) return
    const next = initialMarkdown(slides)
    if (next === markdown) return
    if (markdownMatchesSlides(markdown, slides)) return
    startTransition(() => {
      setMarkdown(next)
      setLastSavedMarkdown(next)
    })
  }, [slidesSyncKey, slides, markdown, lastSavedMarkdown])

  const saveMarkdown = useCallback(
    (current: string) => {
      const lastSaved = lastSavedRef.current
      const account = meRef.current
      if (current === lastSaved) return
      if (hasPendingImageUpload(current)) return
      if (!account?.$isLoaded) return
      assertLoaded(account.root)

      startSaveTransition(() => {
        const r = replaceSlidesFromMarkdown(account, deckId, current)
        if (!r.ok) {
          setError(r.error)
          return
        }
        setError(undefined)
        setLastSavedMarkdown(current)
      })
    },
    [deckId],
  )

  // Save newly resolved Jazz images immediately so refresh/live snapshots can't race them.
  useEffect(() => {
    if (markdown === lastSavedMarkdown) return
    if (hasPendingImageUpload(markdown)) return

    const currentIds = extractJazzImageIds(markdown)
    if (currentIds.length === 0) return

    const savedIds = new Set(extractJazzImageIds(lastSavedMarkdown))
    const hasNewResolvedImage = currentIds.some((id) => !savedIds.has(id))
    if (!hasNewResolvedImage) return

    saveMarkdown(markdown)
  }, [lastSavedMarkdown, markdown, saveMarkdown])

  // Autosave effect - debounced save to Jazz
  useEffect(() => {
    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    // Nothing to save if clean
    if (markdown === lastSavedMarkdown) return

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      // Re-read refs at execution time to get latest values
      const current = markdownRef.current
      saveMarkdown(current)
    }, AUTOSAVE_MS)

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [deckId, lastSavedMarkdown, markdown, saveMarkdown])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
      const current = markdownRef.current
      saveMarkdown(current)
    }
  }, [deckId, saveMarkdown])

  const parsed = useMemo(
    () => parseMarkdownDocumentToSlides(markdown),
    [markdown],
  )
  const nonEmptyParsed = useMemo(
    () =>
      parsed.filter(
        (s) => s.title.trim() !== "" || s.body.trim() !== "",
      ),
    [parsed],
  )
  const revealModels = useMemo(
    () => deckSlidesToRevealModels(nonEmptyParsed),
    [nonEmptyParsed],
  )
  const slidesContentKey = useMemo(
    () =>
      JSON.stringify(
        revealModels.map((s) => [
          s.html,
          s.importedImage?.src ?? null,
          s.poll?.pollKey ?? null,
          s.question?.questionKey ?? null,
          s.interactiveError?.message ?? null,
        ]),
      ),
    [revealModels],
  )

  const isDirty = markdown !== lastSavedMarkdown
  const hasPendingUploads = useMemo(
    () => hasPendingImageUpload(markdown) || pendingImportedUploads > 0,
    [markdown, pendingImportedUploads],
  )

  useEffect(() => {
    let active = true

    const syncPendingCount = async () => {
      const importIds = extractLocalImportedSlideIds(markdownRef.current)
      if (importIds.length === 0) {
        if (active) setPendingImportedUploads(0)
        return
      }
      const records = await Promise.all(
        importIds.map((id) => getImportedSlideRecord(id)),
      )
      if (!active) return
      setPendingImportedUploads(
        records.filter((record) => !record || record.remoteUrl == null).length,
      )
    }

    const flushRemoteForIds = async (ids: string[]) => {
      for (const importId of ids) {
        const result = await ensureImportedSlideUploaded(importId)
        if (!result.remoteUrl) continue
        const url = result.remoteUrl
        setMarkdown((current) => {
          const next = replaceImportedSlideSource(
            current,
            `local://${importId}`,
            url,
          )
          return next === current ? current : next
        })
      }
    }

    const runFullSync = async () => {
      await syncPendingCount()
      const ids = extractLocalImportedSlideIds(markdownRef.current)
      if (ids.length > 0) await flushRemoteForIds(ids)
    }

    void runFullSync()

    const unsubscribe = subscribeToImportedSlideChanges((importId) => {
      if (!extractLocalImportedSlideIds(markdownRef.current).includes(importId)) {
        return
      }
      void (async () => {
        await syncPendingCount()
        await flushRemoteForIds([importId])
      })()
    })

    const timer = window.setInterval(() => {
      void runFullSync()
    }, 15000)

    return () => {
      active = false
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [markdown])

  useEffect(() => {
    onEditorStateChange?.({
      isDirty,
      hasPendingUploads,
      isSaving: pending,
    })
  }, [hasPendingUploads, isDirty, onEditorStateChange, pending])

  const addSlide = () => {
    setMarkdown((m) => {
      const t = m.trim()
      if (t === "") return "# New slide\n\n"
      return `${m.replace(/\s+$/, "")}\n---\n\n# New slide\n\n`
    })
  }

  const handleImageUpload: ImageUploadFn = useCallback(
    async (blob, options) => {
      try {
        if (options?.mode === "imported-slide") {
          const localRecord = await createLocalImportedSlideRecord(blob)
          setPendingImportedUploads((count) => count + 1)
          return {
            markdown: buildImportedSlideDirective(localRecord.src),
          }
        }

        const result = await uploadSlideImage(blob)
        if ("error" in result) {
          setError(result.error)
          return result
        }

        return { markdown: `![image](${result.url})` }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed"
        setError(msg)
        return { error: msg }
      }
    },
    [setError],
  )

  const statusMessage = error
    ? null
    : hasPendingUploads
      ? "Syncing slide media…"
    : pending
      ? "Syncing…"
      : isDirty
        ? "Draft unsaved"
        : "Changes saved"

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="min-h-0 min-w-0 flex-1">
            <DeckMarkdownEditor
              className="h-full min-h-[200px]"
              value={markdown}
              onChange={setMarkdown}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DeckRevealPreview
            slides={revealModels}
            slidesContentKey={slidesContentKey}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMarkdown((m) => appendQuestionSlideMarkdown(m))}
          >
            New Question (MCQ)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMarkdown((m) => appendPollSlideMarkdown(m))}
          >
            New Poll
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setMarkdown((m) => appendBattleRoyaleMarkdown(m))}
          >
            Add Battle Royale
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addSlide}>
            Add slide
          </Button>
        </div>
      </div>
    </div>
  )
}
