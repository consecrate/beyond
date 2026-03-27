"use client"

import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { useState } from "react"

import { cn, Input } from "@beyond/design-system"

export function SessionSearch({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultQuery)

  return (
    <form
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        router.push(q.trim() ? `/sessions?q=${encodeURIComponent(q.trim())}` : "/sessions")
      }}
    >
      <label htmlFor="session-search" className="sr-only">
        Search sessions
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <Input
        id="session-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search sessions and lessons…"
        className={cn("h-9 rounded-sm pl-8")}
        autoComplete="off"
      />
    </form>
  )
}
