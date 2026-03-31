"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { assertLoaded } from "jazz-tools"
import { useAccount, useCoState, useLogOut } from "jazz-tools/react"

import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@beyond/design-system"

import {
  deckSlidesToRevealModels,
  parseMarkdownDocumentToSlides,
} from "@/features/decks/slide-markdown-document"
import {
  clearJoinViewerSessionStorage,
  isJoinSessionExpired,
  readJoinSessionStartedAt,
  readStoredJoinSessionId,
  saveJoinViewerSessionResume,
} from "@/features/jazz/join-viewer-session"
import { LiveSession, PlaydeckAccount } from "@/features/jazz/schema"
import { LiveRevealFollower } from "@/features/slides/live-reveal-follower"

function JoinLiveSessionView({
  sessionId,
  onReturnToCodeEntry,
}: {
  sessionId: string
  onReturnToCodeEntry: () => void
}) {
  const live = useCoState(LiveSession, sessionId, {
    resolve: { poll_votes: { $each: true }, closed_poll_keys: true },
  })

  if (!live.$isLoaded) {
    switch (live.$jazz.loadingState) {
      case "loading":
        return (
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Connecting to session…
          </div>
        )
      case "unauthorized":
        return (
          <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have access to this session.
            </p>
            <Link href="/join" className={buttonVariants({ variant: "outline" })}>
              Back
            </Link>
          </div>
        )
      case "unavailable":
        return (
          <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This session could not be found. It may have ended or the code may
              be wrong.
            </p>
            <Link href="/join" className={buttonVariants({ variant: "outline" })}>
              Try another code
            </Link>
          </div>
        )
      default:
        return (
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )
    }
  }

  if (typeof live.markdown !== "string") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading deck…
      </div>
    )
  }

  const parsedSlides = parseMarkdownDocumentToSlides(live.markdown)
  const slides = deckSlidesToRevealModels(parsedSlides)

  if (slides.length < 1) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">This session has no slides.</p>
        <Link href="/join" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>
    )
  }

  assertLoaded(live)

  if (live.status === "ended") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          This live session has ended.
        </p>
        <Button type="button" variant="outline" onClick={onReturnToCodeEntry}>
          Try another code
        </Button>
      </div>
    )
  }

  return (
    <LiveRevealFollower
      sessionId={sessionId}
      deckTitle={live.deckTitle}
      slides={slides}
      activeSlideIndex={live.activeSlideIndex}
      liveSession={live}
    />
  )
}

export default function JoinPage() {
  const me = useAccount(PlaydeckAccount, { resolve: { profile: true } })
  const logOut = useLogOut()

  const [step, setStep] = useState<1 | 2>(1)
  const [code, setCode] = useState("")
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)

  const applyStorageBootstrap = useCallback(() => {
    const sid = readStoredJoinSessionId()
    const started = readJoinSessionStartedAt()

    if (sid && started != null && !isJoinSessionExpired(started)) {
      setSessionId(sid)
      return
    }

    if (sid != null || started != null) {
      clearJoinViewerSessionStorage()
      void logOut()
    }
  }, [logOut])

  useEffect(() => {
    applyStorageBootstrap()
    setStorageReady(true)
  }, [applyStorageBootstrap])

  async function handleSessionCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedCode = code.trim()

    if (!trimmedCode) {
      setError("Enter a session code.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch(
        `/api/live-sessions?code=${encodeURIComponent(trimmedCode)}`,
      )
      const data = (await res.json().catch(() => null)) as {
        sessionId?: string
        error?: string
      } | null

      if (!res.ok || !data?.sessionId) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not find a session for that code.",
        )
        return
      }

      setResolvedSessionId(data.sessionId)
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  function handleBackFromUsername() {
    setStep(1)
    setResolvedSessionId(null)
    setError(null)
  }

  const handleReturnToCodeEntry = useCallback(() => {
    clearJoinViewerSessionStorage()
    setSessionId(null)
    setResolvedSessionId(null)
    setStep(1)
    setCode("")
    setDisplayName("")
    setError(null)
  }, [])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedName = displayName.trim()

    if (!trimmedName) {
      setError("Enter your name.")
      return
    }
    if (!resolvedSessionId) {
      setError("Session is missing. Enter the code again.")
      setStep(1)
      return
    }
    if (!me.$isLoaded) {
      setError("Still setting up. Try again in a moment.")
      return
    }

    setBusy(true)
    try {
      assertLoaded(me)
      assertLoaded(me.profile)
      me.profile.$jazz.applyDiff({ name: trimmedName })
      saveJoinViewerSessionResume(resolvedSessionId)
      setSessionId(resolvedSessionId)
    } finally {
      setBusy(false)
    }
  }

  if (!storageReady) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (sessionId) {
    return (
      <JoinLiveSessionView
        sessionId={sessionId}
        onReturnToCodeEntry={handleReturnToCodeEntry}
      />
    )
  }

  const accountReady = me.$isLoaded

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join a session</CardTitle>
          {step === 1 ? (
            <CardDescription>Enter the code and jump in!</CardDescription>
          ) : (
            <CardDescription>Enter how you want to appear to others.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={handleSessionCodeSubmit}
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="join-session-code" className="text-sm font-medium">
                  Session code
                </label>
                <Input
                  id="join-session-code"
                  placeholder="Session code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={busy}
                  aria-invalid={error ? true : undefined}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" size="lg" className="flex-1" disabled={busy}>
                  {busy ? "Checking…" : "Continue"}
                </Button>
                <Link
                  href="/"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  ← Back
                </Link>
              </div>
            </form>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={handleJoin}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="join-display-name" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="join-display-name"
                  placeholder="Username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  disabled={busy}
                  aria-invalid={error ? true : undefined}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  disabled={busy || !accountReady}
                >
                  {busy ? "Joining…" : accountReady ? "Join" : "Connecting…"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleBackFromUsername}
                  disabled={busy}
                >
                  ← Back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
