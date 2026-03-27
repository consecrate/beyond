"use client"

import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { useState } from "react"

import { cn, Input } from "@beyond/design-system"

export function LessonSearch({ defaultQuery = "" }: { defaultQuery?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultQuery)

  return (
    <form
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        router.push(q.trim() ? `/lessons?q=${encodeURIComponent(q.trim())}` : "/lessons")
      }}
    >
      <label htmlFor="lesson-search" className="sr-only">
        Search lessons
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <Input
        id="lesson-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search lessons…"
        className={cn("h-9 rounded-sm pl-8")}
        autoComplete="off"
      />
    </form>
  )
}
