"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

export function PresenterDeckSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qParam = searchParams.get("q") ?? ""
  const [value, setValue] = useState(qParam)

  useEffect(() => {
    setValue(qParam)
  }, [qParam])

  const submit = useCallback(() => {
    const q = value.trim()
    router.push(q ? `/presenter/decks?q=${encodeURIComponent(q)}` : "/presenter/decks")
  }, [router, value])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-sm border border-border bg-muted/40 px-2.5 py-1.5"
      role="search"
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="presenter-deck-search" className="sr-only">
        Search decks
      </label>
      <input
        id="presenter-deck-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search decks…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        autoComplete="off"
      />
    </form>
  )
}
