"use client"

import { JazzReactProvider } from "jazz-tools/react"
import { Loader2 } from "lucide-react"

import { getJazzSyncPeer } from "@/features/jazz/env"
import { JOIN_VIEWER_AUTH_SECRET_STORAGE_KEY } from "@/features/jazz/join-viewer-session"
import { PlaydeckAccount } from "@/features/jazz/schema"

function JoinJazzFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2
        className="size-8 animate-spin text-muted-foreground"
        aria-label="Loading"
      />
    </div>
  )
}

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <JazzReactProvider
      sync={{ peer: getJazzSyncPeer() }}
      AccountSchema={PlaydeckAccount}
      authSecretStorageKey={JOIN_VIEWER_AUTH_SECRET_STORAGE_KEY}
      fallback={<JoinJazzFallback />}
    >
      {children}
    </JazzReactProvider>
  )
}
