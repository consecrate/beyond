"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { updateDeckTitle } from "@/features/decks/jazz-deck-mutations"
import { cn } from "@beyond/design-system"

const heroTitleClassName = cn(
  "font-display flex min-h-9 w-full items-center text-2xl font-medium leading-9 tracking-[-0.02em] text-foreground sm:text-3xl",
)

const chromeTitleClassName = cn(
  "flex min-h-8 w-full max-w-full items-center justify-center text-center text-sm font-normal leading-none tracking-tight text-muted-foreground",
)

const chromeInputClassName = cn(
  "flex h-8 w-full max-w-full items-center justify-center text-center text-sm font-normal leading-none tracking-tight text-foreground",
)

type Props = {
  deckId: string
  initialTitle: string
  trailing?: React.ReactNode
  appearance?: "hero" | "chrome"
}

export function EditableDeckTitle({
  deckId,
  initialTitle,
  trailing,
  appearance = "hero",
}: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: { root: { decks: { $each: true } } },
  })
  const isChrome = appearance === "chrome"
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [committedTitle, setCommittedTitle] = useState(initialTitle)
  const [draft, setDraft] = useState(initialTitle)
  const [error, setError] = useState<string | undefined>()
  const escapeRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [prevInitialTitle, setPrevInitialTitle] = useState(initialTitle)
  if (initialTitle !== prevInitialTitle) {
    setPrevInitialTitle(initialTitle)
    if (!editing) {
      setCommittedTitle(initialTitle)
    }
  }

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  const beginEdit = useCallback(() => {
    setDraft(committedTitle)
    setError(undefined)
    setEditing(true)
  }, [committedTitle])

  const cancelEdit = useCallback(() => {
    setDraft(committedTitle)
    setError(undefined)
    setEditing(false)
  }, [committedTitle])

  const commit = useCallback(() => {
    if (pending) return
    const trimmed = draft.trim()
    if (!trimmed) {
      cancelEdit()
      return
    }
    if (trimmed === committedTitle) {
      setError(undefined)
      setEditing(false)
      return
    }
    if (!me.$isLoaded) return
    assertLoaded(me.root)
    startTransition(() => {
      const r = updateDeckTitle(me, deckId, trimmed)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setCommittedTitle(trimmed)
      setError(undefined)
      setEditing(false)
    })
  }, [cancelEdit, committedTitle, deckId, draft, me, pending])

  const onHeadingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      beginEdit()
    }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      escapeRef.current = true
      cancelEdit()
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    }
  }

  const onInputBlur = () => {
    if (escapeRef.current) {
      escapeRef.current = false
      return
    }
    commit()
  }

  if (editing) {
    if (isChrome) {
      return (
        <div className="flex min-w-0 flex-col items-center">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
            disabled={pending}
            autoComplete="off"
            aria-invalid={error != null}
            className={cn(
              chromeInputClassName,
              "border-0 border-b border-border bg-transparent px-1 py-0 shadow-none outline-none",
              "transition-[border-color,box-shadow] focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          />
          {error ? (
            <p className="mt-1 max-w-full truncate text-center text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
            disabled={pending}
            autoComplete="off"
            aria-invalid={error != null}
            className={cn(
              heroTitleClassName,
              "border-0 border-b border-border bg-transparent px-0 py-0 shadow-none outline-none",
              "transition-[border-color,box-shadow] focus-visible:border-ring/80 focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
          />
          {error ? (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        {trailing}
      </div>
    )
  }

  if (isChrome) {
    return (
      <div className="flex min-w-0 flex-col items-center">
        <h1
          tabIndex={0}
          className={cn(
            chromeTitleClassName,
            "min-w-0 cursor-text truncate outline-none",
          )}
          onClick={beginEdit}
          onKeyDown={onHeadingKeyDown}
          aria-label="Deck title, press Enter to edit"
        >
          {committedTitle}
        </h1>
      </div>
    )
  }

  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <h1
        tabIndex={0}
        className={cn(
          heroTitleClassName,
          "min-w-0 flex-1 cursor-text outline-none",
        )}
        onClick={beginEdit}
        onKeyDown={onHeadingKeyDown}
        aria-label="Deck title, press Enter to edit"
      >
        {committedTitle}
      </h1>
      {trailing}
    </div>
  )
}
