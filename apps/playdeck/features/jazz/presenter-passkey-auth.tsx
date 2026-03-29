"use client"

import { Button, Input } from "@beyond/design-system"
import { usePasskeyAuth } from "jazz-tools/react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const APP_NAME = "PlayDeck"

function isPresenterAuthRoute(pathname: string): boolean {
  return pathname === "/presenter/sign-in" || pathname === "/presenter/sign-up"
}

function AuthRedirectLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2
        className="size-8 animate-spin text-muted-foreground"
        aria-label="Loading"
      />
    </div>
  )
}

function mapAuthError(error: Error): string {
  if (error.cause instanceof Error) {
    return error.cause.message
  }
  return error.message
}

export function PresenterPasskeyAuth({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendingSignUp, setPendingSignUp] = useState(false)
  const [pendingLogIn, setPendingLogIn] = useState(false)

  const auth = usePasskeyAuth({ appName: APP_NAME })

  useEffect(() => {
    if (auth.state !== "signedIn") return
    if (!isPresenterAuthRoute(pathname)) return
    router.replace("/presenter/decks")
  }, [auth.state, pathname, router])

  if (auth.state === "signedIn") {
    if (isPresenterAuthRoute(pathname)) {
      return <AuthRedirectLoading />
    }
    return <>{children}</>
  }

  const isSignUpRoute = pathname === "/presenter/sign-up"

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {isSignUpRoute ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUpRoute
              ? "Start building interactive decks for your classroom."
              : "Sign in to manage your decks."}
          </p>
        </div>

        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {isSignUpRoute ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              setPendingSignUp(true)
              auth
                .signUp(displayName)
                .catch((err: Error) => setError(mapAuthError(err)))
                .finally(() => setPendingSignUp(false))
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="presenter-display-name" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="presenter-display-name"
                name="displayName"
                type="text"
                required
                autoComplete="name"
                placeholder="Ms. Nguyen"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" disabled={pendingSignUp} className="mt-2">
              {pendingSignUp ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/presenter/sign-in"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              size="lg"
              disabled={pendingLogIn}
              className="mt-2"
              onClick={() => {
                setError(null)
                setPendingLogIn(true)
                auth
                  .logIn()
                  .catch((err: Error) => setError(mapAuthError(err)))
                  .finally(() => setPendingLogIn(false))
              }}
            >
              {pendingLogIn ? "Signing in…" : "Sign in with passkey"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/presenter/sign-up"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Create one
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
