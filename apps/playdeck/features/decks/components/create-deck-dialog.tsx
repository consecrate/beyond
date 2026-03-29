"use client"

import { useRef, useState, useTransition } from "react"

import { useAccount } from "jazz-tools/react"
import { assertLoaded } from "jazz-tools"

import { PlaydeckAccount } from "@/features/jazz/schema"
import { createDeckFromTitle } from "@/features/decks/jazz-deck-mutations"
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@beyond/design-system"
import { Plus } from "lucide-react"

type Props = {
  triggerClassName?: string
  variant?: "default" | "slim" | "tile"
}

export function CreateDeckDialog({ triggerClassName, variant = "default" }: Props) {
  const me = useAccount(PlaydeckAccount, {
    resolve: { root: { decks: true } },
  })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const trigger =
    variant === "tile" ? (
      <Button
        type="button"
        variant="outline"
        className={cn(
          "group relative h-auto w-full cursor-pointer flex-col overflow-hidden rounded-sm border border-border bg-card p-0 font-normal shadow-none transition-colors",
          "hover:border-border hover:bg-card",
          triggerClassName,
        )}
      >
        <div className="relative aspect-4/3 w-full bg-muted">
          <div className="absolute inset-2 flex flex-col items-center justify-center gap-1.5 rounded-sm border border-border/50 bg-background/90 px-2 py-3">
            <Plus
              className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="text-center text-xs leading-none text-muted-foreground">
              Create New Deck
            </span>
          </div>
        </div>
      </Button>
    ) : variant === "slim" ? (
      <Button
        variant="ghost"
        className={cn(
          "h-auto flex-col gap-0.5 rounded-sm px-1 py-2 text-[11px] leading-tight font-normal text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          triggerClassName,
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-sm">
          <Plus className="size-4.5" strokeWidth={1.5} aria-hidden />
        </span>
        <span>New</span>
      </Button>
    ) : (
      <Button className={cn(triggerClassName)}>
        <Plus className="mr-2 h-4 w-4" />
        New deck
      </Button>
    )

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!me.$isLoaded) return
    assertLoaded(me.root)
    const fd = new FormData(e.currentTarget)
    const title = (fd.get("title") as string) ?? ""
    startTransition(() => {
      const r = createDeckFromTitle(me, title)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError(undefined)
      setOpen(false)
      formRef.current?.reset()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new deck</DialogTitle>
          <DialogDescription>
            Give your deck a title to get started.
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="deckTitle" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="deckTitle"
              name="title"
              required
              placeholder="My awesome deck"
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create deck"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
