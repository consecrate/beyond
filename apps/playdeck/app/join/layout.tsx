"use client"

import { JazzReactProvider } from "jazz-tools/react"
import { Loader2 } from "lucide-react"

import { getJazzSyncPeer } from "@/features/jazz/env"

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
      guestMode
      sync={{ peer: getJazzSyncPeer() }}
      fallback={<JoinJazzFallback />}
    >
      {children}
    </JazzReactProvider>
  )
}
