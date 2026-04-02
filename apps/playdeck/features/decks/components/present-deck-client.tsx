"use client"

/* eslint-disable react-hooks/refs -- live session + Jazz subscription need ref fallbacks ESLint cannot model */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import type { Loaded } from "jazz-tools"
import { assertLoaded, ImageDefinition } from "jazz-tools"
import { useAccount } from "jazz-tools/react"
import { useCoState } from "jazz-tools/react"

import { coValueId, deckSlidesToViews } from "@/features/decks/deck-map"
import { findDeck } from "@/features/decks/jazz-deck-mutations"
import {
  presenterRevealSlidesFromSources,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import {
  ensureImportedSlideUploaded,
} from "@/features/decks/local-imported-slide-store"
import { extractLocalImportedSlideIds } from "@/features/decks/parse-slide-import"
import {
  closePoll,
  endLiveSession,
  startQuestion,
  startLiveSession,
  stopQuestion,
  replaceImportedLiveSlideSource,
  updateLiveSlideIndex,
  setLobbyVisible,
  kickPlayer,
  startTeamFormation,
  assignTeamLeader,
  openTeamJoining,
  autoAssignRemainingTeams,
  startGameStore,
  startGameplay,
  resetBattleTargetSelection,
  showBattleLog,
  showPodium,
  leaveBattleRoyaleAfterPodium,
} from "@/features/jazz/live-session-mutations"
import { LiveSession, PlaydeckAccount } from "@/features/jazz/schema"
import { extractJazzImageIds } from "@/features/slides/jazz-image-ids"
import { PresentRevealLoader } from "@/features/slides/present-reveal-loader"

async function findUnreadableDeckImages(
  me: Loaded<typeof PlaydeckAccount>,
  markdown: string,
): Promise<string[]> {
  const ids = extractJazzImageIds(markdown)
  if (ids.length === 0) return []

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const imageDef = await ImageDefinition.load(id, {
          as: me,
          resolve: { original: true },
        } as Parameters<typeof ImageDefinition.load>[1])
        return imageDef?.$isLoaded ? null : id
      } catch {
        return id
      }
    }),
  )

  return results.filter((id): id is string => id != null)
}

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
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null)

  const liveSessionSub = useCoState(LiveSession, liveSessionId ?? undefined, {
    resolve: {
      joined_players: { $each: true },
      poll_votes: { $each: true },
      closed_poll_keys: true,
      question_submissions: { $each: true },
      question_states: { $each: true },
      teams: { $each: true },
      battle_state: {
        round_summary: { entries: { $each: true } },
        team_prep: { $each: true },
      },
    },
  })

  useEffect(() => {
    joinCodeRef.current = joinCode
  }, [joinCode])

  const liveMarkdownKey =
    liveSessionSub.$isLoaded
      ? liveSessionSub.markdown
      : liveSessionRef.current?.markdown ?? null

  const tearDownLiveSession = useCallback((opts: { keepalive: boolean }) => {
    const session = liveSessionRef.current
    const code = joinCodeRef.current
    if (session) {
      endLiveSession(session)
    }
    liveSessionRef.current = null
    joinCodeRef.current = null
    setLiveSessionId(null)
    if (code) {
      void fetch(
        `/api/live-sessions?code=${encodeURIComponent(code)}`,
        {
          method: "DELETE",
          ...(opts.keepalive ? { keepalive: true as const } : {}),
        },
      ).catch(() => { })
    }
  }, [])

  const handleGoLive = useCallback(
    async (currentSlideIndex: number) => {
      if (!me.$isLoaded) return
      assertLoaded(me.root)
      const deck = findDeck(me.root, deckId)
      if (!deck) return

      const markdown = slidesToMarkdownDocument(deckSlidesToViews(deck))
      const pendingImportedIds = extractLocalImportedSlideIds(markdown)
      if (pendingImportedIds.length > 0) {
        const proceed = window.confirm(
          `This deck still has ${pendingImportedIds.length} imported slide(s) that only exist locally on this device. Presenter view can continue, but audience devices may see a waiting state until upload finishes.\n\nStart live anyway?`,
        )
        if (!proceed) return

        for (const importId of pendingImportedIds) {
          void ensureImportedSlideUploaded(importId)
        }
      }

      const unreadableImages = await findUnreadableDeckImages(me, markdown)
      if (unreadableImages.length > 0) {
        window.alert(
          `Some slide images are not readable yet. Wait a moment and try again.\n\nMissing: ${unreadableImages.slice(0, 3).join(", ")}`,
        )
        return
      }

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
        const created = result.liveSession
        liveSessionRef.current = null
        endLiveSession(created)
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
      setLiveSessionId(sessionId)
    },
    [deckId, me],
  )

  useEffect(() => {
    const session = liveSessionSub.$isLoaded
      ? liveSessionSub
      : liveSessionRef.current
    if (!session) return

    const importIds = extractLocalImportedSlideIds(session.markdown)
    if (importIds.length === 0) return

    const syncLocalImports = () => {
      for (const importId of importIds) {
        void ensureImportedSlideUploaded(importId).then((result) => {
          if (!result.remoteUrl) return
          replaceImportedLiveSlideSource(
            session,
            `local://${importId}`,
            result.remoteUrl,
          )
        })
      }
    }
    syncLocalImports()
    const timer = window.setInterval(syncLocalImports, 15000)
    return () => window.clearInterval(timer)
  }, [liveMarkdownKey, liveSessionSub])

  const handleSlideIndexSync = useCallback((index: number) => {
    const session = liveSessionRef.current
    if (!session) return
    updateLiveSlideIndex(session, index)
  }, [])

  const handleChangeCode = useCallback(async (newCode: string) => {
    const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
    if (!session) return { ok: false, error: "No active session" }
    if (!joinCodeRef.current) return { ok: false, error: "No existing code" }

    try {
      const res = await fetch("/api/live-sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: coValueId(session),
          oldCode: joinCodeRef.current,
          newCode,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        return { ok: false, error: err?.error || "Could not change code" }
      }

      const data = await res.json()
      joinCodeRef.current = data.code
      setJoinCode(data.code)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: "Network error" }
    }
  }, [liveSessionSub])

  const handleClosePoll = useCallback(
    (pollKey: string) => {
      if (!me.$isLoaded || !liveSessionSub.$isLoaded) return
      assertLoaded(me)
      const r = closePoll(me, liveSessionSub, pollKey)
      if (!r.ok) window.alert(r.error)
    },
    [me, liveSessionSub],
  )

  const handleStartQuestion = useCallback(
    (questionKey: string) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded
        ? liveSessionSub
        : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      const result = startQuestion(me, session, questionKey)
      if (!result.ok) {
        window.alert(result.error)
      }
    },
    [me, liveSessionSub],
  )

  const handleStopQuestion = useCallback(
    (questionKey: string, correctOptionIndex?: number) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded
        ? liveSessionSub
        : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      const result = stopQuestion(me, session, questionKey, correctOptionIndex)
      if (!result.ok) {
        window.alert(result.error)
      }
    },
    [me, liveSessionSub],
  )

  const handleSetLobbyVisible = useCallback(
    (visible: boolean) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded
        ? liveSessionSub
        : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      setLobbyVisible(me, session, visible)
    },
    [me, liveSessionSub],
  )

  const handleKickPlayer = useCallback(
    (accountId: string) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded
        ? liveSessionSub
        : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      kickPlayer(me, session, accountId)
    },
    [me, liveSessionSub],
  )

  const handleStartTeamFormation = useCallback(
    (numTeams: number) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      startTeamFormation(me, session, numTeams)
    },
    [me, liveSessionSub],
  )

  const handleAssignTeamLeader = useCallback(
    (teamId: string, accountId: string | undefined) => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      assignTeamLeader(me, session, teamId, accountId)
    },
    [me, liveSessionSub],
  )

  const handleOpenTeamJoining = useCallback(
    () => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      openTeamJoining(me, session)
    },
    [me, liveSessionSub],
  )

  const handleAutoAssignTeams = useCallback(
    () => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      autoAssignRemainingTeams(me, session)
    },
    [me, liveSessionSub],
  )

  const handleStartGameStore = useCallback(
    () => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      startGameStore(me, session)
    },
    [me, liveSessionSub],
  )

  const handleStartGameplay = useCallback(
    () => {
      if (!me.$isLoaded) return
      const session = liveSessionSub.$isLoaded ? liveSessionSub : liveSessionRef.current
      if (!session) return
      assertLoaded(me)
      startGameplay(me, session)
    },
    [me, liveSessionSub],
  )

  const handleResetBattleRound = useCallback(() => {
    if (!me.$isLoaded) return
    const session = liveSessionSub.$isLoaded
      ? liveSessionSub
      : liveSessionRef.current
    if (!session) return
    assertLoaded(me)
    resetBattleTargetSelection(me, session)
  }, [me, liveSessionSub])

  const handleShowBattleLog = useCallback(() => {
    if (!me.$isLoaded) return
    const session = liveSessionSub.$isLoaded
      ? liveSessionSub
      : liveSessionRef.current
    if (!session) return
    assertLoaded(me)
    const result = showBattleLog(me, session)
    if (!result.ok) {
      window.alert(result.error)
    }
  }, [me, liveSessionSub])

  const handleShowPodium = useCallback(() => {
    if (!me.$isLoaded) return
    const session = liveSessionSub.$isLoaded
      ? liveSessionSub
      : liveSessionRef.current
    if (!session) return
    assertLoaded(me)
    const result = showPodium(me, session)
    if (!result.ok) {
      window.alert(result.error)
    }
  }, [me, liveSessionSub])

  const handleLeaveBattleRoyaleAfterPodium = useCallback(() => {
    if (!me.$isLoaded) return
    const session = liveSessionSub.$isLoaded
      ? liveSessionSub
      : liveSessionRef.current
    if (!session) return
    assertLoaded(me)
    const result = leaveBattleRoyaleAfterPodium(me, session)
    if (!result.ok) {
      window.alert(result.error)
    }
  }, [me, liveSessionSub])

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

  const views = deckSlidesToViews(deck)
  const slidesForPresentation = presenterRevealSlidesFromSources({
    liveMarkdown:
      joinCode !== null && liveSessionSub.$isLoaded
        ? liveSessionSub.markdown
        : undefined,
    deckViews: views,
  })

  const liveSessionResolved =
    joinCode !== null && liveSessionSub.$isLoaded ? liveSessionSub : null

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
        onChangeCode: handleChangeCode,
        liveSession: liveSessionResolved,
        onClosePoll: handleClosePoll,
        onStartQuestion: handleStartQuestion,
        onStopQuestion: handleStopQuestion,
        onSetLobbyVisible: handleSetLobbyVisible,
        onKickPlayer: handleKickPlayer,
        onStartTeamFormation: handleStartTeamFormation,
        onAssignTeamLeader: handleAssignTeamLeader,
        onOpenTeamJoining: handleOpenTeamJoining,
        onAutoAssignTeams: handleAutoAssignTeams,
        onStartGameStore: handleStartGameStore,
        onStartGameplay: handleStartGameplay,
        onResetBattleRound: handleResetBattleRound,
        onShowBattleLog: handleShowBattleLog,
        onShowPodium: handleShowPodium,
        onLeaveBattleRoyaleAfterPodium: handleLeaveBattleRoyaleAfterPodium,
      }}
    />
  )
}
