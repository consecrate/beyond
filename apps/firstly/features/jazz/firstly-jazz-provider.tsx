"use client"

import { JazzReactProvider } from "jazz-tools/react"
import { Loader2 } from "lucide-react"

import { getJazzSyncPeer } from "./env"
import { FirstlyPasskeyAuth } from "./firstly-passkey-auth"
import { FirstlyAccount } from "./schema"

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

export function FirstlyJazzProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <JazzReactProvider
      sync={{ peer: getJazzSyncPeer() }}
      AccountSchema={FirstlyAccount}
      fallback={<JazzLoadingFallback />}
    >
      <FirstlyPasskeyAuth>{children}</FirstlyPasskeyAuth>
    </JazzReactProvider>
  )
}
