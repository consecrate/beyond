"use client"

import { useState } from "react"
import Link from "next/link"
import { useCoState } from "jazz-tools/react"

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
import { LiveSession } from "@/features/jazz/schema"
import { LiveRevealFollower } from "@/features/slides/live-reveal-follower"

function JoinLiveSessionView({ sessionId }: { sessionId: string }) {
  const live = useCoState(LiveSession, sessionId)

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

  return (
    <LiveRevealFollower
      sessionId={sessionId}
      deckTitle={live.deckTitle}
      slides={slides}
      activeSlideIndex={live.activeSlideIndex}
      status={live.status}
    />
  )
}

export default function JoinPage() {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = code.trim()
    if (!trimmed) {
      setError("Enter a session code.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch(
        `/api/live-sessions?code=${encodeURIComponent(trimmed)}`,
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

      setSessionId(data.sessionId)
    } finally {
      setBusy(false)
    }
  }

  if (sessionId) {
    return <JoinLiveSessionView sessionId={sessionId} />
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join a session</CardTitle>
          <CardDescription>
            Enter the session code shared by your instructor to follow the live
            slides.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={handleJoin}>
            <Input
              placeholder="Session code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="flex-1" disabled={busy}>
                {busy ? "Joining…" : "Join"}
              </Button>
              <Link
                href="/"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                ← Back
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
