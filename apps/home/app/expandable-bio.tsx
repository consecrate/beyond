"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const ELLE_PHRASE = "an applied maths club at "
const VGU_FULL = "the Vietnamese-German University"
const RELATIONSHIP_FULL = "relationship with someone awesome"

function randomWordDelayMs(): number {
  return 200 + Math.floor(Math.random() * 301)
}

function visibleWords(
  words: readonly string[],
  wordCount: number,
  originalEndsWithSpace: boolean,
): string {
  if (wordCount === 0) return ""
  const s = words.slice(0, wordCount).join(" ")
  if (wordCount < words.length) return `${s} `
  if (originalEndsWithSpace) return `${s} `
  return s
}

function useWordReveal(fullText: string) {
  const words = useMemo(() => {
    const t = fullText.trim()
    return t ? t.split(/\s+/) : []
  }, [fullText])
  const originalEndsWithSpace = fullText.endsWith(" ")

  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (words.length === 0) return

    let cancelled = false
    let timeoutId: number
    let current = 0

    const revealNext = () => {
      if (cancelled) return
      current += 1
      setWordCount(current)
      if (current < words.length) {
        timeoutId = window.setTimeout(revealNext, randomWordDelayMs())
      }
    }

    revealNext()

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [fullText, words.length])

  const visible = visibleWords(words, wordCount, originalEndsWithSpace)
  const complete = wordCount >= words.length

  return { visible, complete }
}

function ElleExpandedPhrase({
  vguExpanded,
  onExpandVgu,
}: {
  vguExpanded: boolean
  onExpandVgu: () => void
}) {
  const elleTw = useWordReveal(ELLE_PHRASE)
  const showVgu = elleTw.complete

  return (
    <span className="expand-phrase">
      <span>Elle, </span>
      {elleTw.visible}
      {showVgu ? (
        !vguExpanded ? (
          <button
            type="button"
            className="expand-trigger"
            onClick={onExpandVgu}
            aria-expanded={false}
            aria-label="Expand VGU"
          >
            VGU
          </button>
        ) : (
          <VguExpandedPhrase />
        )
      ) : null}
    </span>
  )
}

function VguExpandedPhrase() {
  const vguTw = useWordReveal(VGU_FULL)

  return (
    <span aria-live="polite">
      {vguTw.visible}
    </span>
  )
}

function RelationshipExpandedPhrase() {
  const tw = useWordReveal(RELATIONSHIP_FULL)

  return (
    <span aria-live="polite">
      {tw.visible}
    </span>
  )
}

export function ExpandableBio() {
  const [elleExpanded, setElleExpanded] = useState(false)
  const [vguExpanded, setVguExpanded] = useState(false)
  const [relationshipExpanded, setRelationshipExpanded] = useState(false)

  const expandElle = useCallback(() => {
    setElleExpanded(true)
  }, [])

  const expandVgu = useCallback(() => {
    setVguExpanded(true)
  }, [])

  const expandRelationship = useCallback(() => {
    setRelationshipExpanded(true)
  }, [])

  return (
    <p className="bio">
      I love building things. Currently building{" "}
      {!elleExpanded ? (
        <button
          type="button"
          className="expand-trigger"
          onClick={expandElle}
          aria-expanded={false}
          aria-label="Expand Elle"
        >
          Elle
        </button>
      ) : (
        <ElleExpandedPhrase
          vguExpanded={vguExpanded}
          onExpandVgu={expandVgu}
        />
      )}{" "}
      and a{" "}
      {relationshipExpanded ? (
        <RelationshipExpandedPhrase />
      ) : (
        <button
          type="button"
          className="expand-trigger"
          onClick={expandRelationship}
          aria-expanded={false}
          aria-label="Expand relationship"
        >
          relationship
        </button>
      )}{" "}
      🌝.
    </p>
  )
}
