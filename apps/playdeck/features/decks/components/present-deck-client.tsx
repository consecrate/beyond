"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import type { Loaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { coValueId, deckSlidesToViews } from "@/features/decks/deck-map"
import { findDeck } from "@/features/decks/jazz-deck-mutations"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"
import {
  endLiveSession,
  startLiveSession,
  updateLiveSlideIndex,
} from "@/features/jazz/live-session-mutations"
import { LiveSession, PlaydeckAccount } from "@/features/jazz/schema"
import { PresentRevealLoader } from "@/features/slides/present-reveal-loader"

function RedirectToDecks() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/presenter/decks")
  }, [router])
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Redirecting…
    </div>
  )
}

type Props = {
  deckId: string
  initialSlideIndex: number
}

export function PresentDeckClient({ deckId, initialSlideIndex }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: {
      root: {
        decks: { $each: { slides: { $each: true } } },
      },
    },
  })

  const liveSessionRef = useRef<Loaded<typeof LiveSession> | null>(null)
  const joinCodeRef = useRef<string | null>(null)
  const [joinCode, setJoinCode] = useState<string | null>(null)

  useEffect(() => {
    joinCodeRef.current = joinCode
  }, [joinCode])

  const tearDownLiveSession = useCallback((opts: { keepalive: boolean }) => {
    const session = liveSessionRef.current
    const code = joinCodeRef.current
    if (session) {
      endLiveSession(session)
    }
    liveSessionRef.current = null
    joinCodeRef.current = null
    if (code) {
      void fetch(
        `/api/live-sessions?code=${encodeURIComponent(code)}`,
        {
          method: "DELETE",
          ...(opts.keepalive ? { keepalive: true as const } : {}),
        },
      ).catch(() => {})
    }
  }, [])

  const handleGoLive = useCallback(
    async (currentSlideIndex: number) => {
      if (!me.$isLoaded) return
      assertLoaded(me.root)
      const deck = findDeck(me.root, deckId)
      if (!deck) return

      const result = startLiveSession(me, deck, currentSlideIndex)
      if (!result.ok) {
        window.alert(result.error)
        return
      }

      liveSessionRef.current = result.liveSession
      const sessionId = coValueId(result.liveSession)

      const res = await fetch("/api/live-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      if (!res.ok) {
        liveSessionRef.current = null
        const err = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        window.alert(
          typeof err?.error === "string"
            ? err.error
            : "Could not register a join code.",
        )
        return
      }

      const data = (await res.json()) as { code: string }
      joinCodeRef.current = data.code
      setJoinCode(data.code)
    },
    [deckId, me],
  )

  const handleSlideIndexSync = useCallback((index: number) => {
    const session = liveSessionRef.current
    if (!session) return
    updateLiveSlideIndex(session, index)
  }, [])

  const handleEndLive = useCallback(() => {
    tearDownLiveSession({ keepalive: false })
    setJoinCode(null)
  }, [tearDownLiveSession])

  useEffect(() => {
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return
      tearDownLiveSession({ keepalive: true })
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [tearDownLiveSession])

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setTimeout(() => {
        if (!mountedRef.current) {
          tearDownLiveSession({ keepalive: false })
        }
      }, 0)
    }
  }, [tearDownLiveSession])

  if (!me.$isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  assertLoaded(me.root)
  const deck = findDeck(me.root, deckId)
  if (!deck) {
    return <RedirectToDecks />
  }

  const slides = deckSlidesToViews(deck)
  const slidesForPresentation = slides.map((s) => ({
    title: s.title,
    html: slideMarkdownToSafeHtml(s.body),
  }))

  return (
    <PresentRevealLoader
      deckTitle={deck.title}
      slides={slidesForPresentation}
      backHref={`/presenter/decks/${deckId}`}
      initialSlideIndex={initialSlideIndex}
      live={{
        isActive: joinCode !== null,
        joinCode,
        onGoLive: handleGoLive,
        onEndLive: handleEndLive,
        onSlideIndexSync: handleSlideIndexSync,
      }}
    />
  )
}
