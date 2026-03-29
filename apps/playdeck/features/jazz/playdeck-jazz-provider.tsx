"use client"

import { JazzReactProvider } from "jazz-tools/react"
import { Loader2 } from "lucide-react"

import { getJazzSyncPeer } from "./env"
import { PresenterPasskeyAuth } from "./presenter-passkey-auth"
import { PlaydeckAccount } from "./schema"

function JazzLoadingFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2
        className="size-8 animate-spin text-muted-foreground"
        aria-label="Loading"
      />
    </div>
  )
}

export function PlaydeckJazzProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <JazzReactProvider
      sync={{ peer: getJazzSyncPeer() }}
      AccountSchema={PlaydeckAccount}
      fallback={<JazzLoadingFallback />}
    >
      <PresenterPasskeyAuth>{children}</PresenterPasskeyAuth>
    </JazzReactProvider>
  )
}
