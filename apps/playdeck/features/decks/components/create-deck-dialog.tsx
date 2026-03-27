"use client"

import { useActionState, useRef } from "react"

import { createDeck, type DeckActionState } from "@/features/decks/actions"
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
  Textarea,
} from "@beyond/design-system"
import { Plus } from "lucide-react"

const initialState: DeckActionState = {}

type Props = {
  triggerClassName?: string
  /** Narrow icon + label stack for slim presenter sidebar; tile is the create card on the decks grid */
  variant?: "default" | "slim" | "tile"
}

export function CreateDeckDialog({ triggerClassName, variant = "default" }: Props) {
  const [state, action, pending] = useActionState(createDeck, initialState)
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

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new deck</DialogTitle>
          <DialogDescription>
            Give your deck a title to get started.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={action} className="flex flex-col gap-4">
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="deckDescription" className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="deckDescription"
              name="description"
              placeholder="What is this deck about?"
              rows={2}
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
