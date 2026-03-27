"use client"

import { useActionState } from "react"

import { updateDeck, type DeckActionState } from "@/features/decks/actions"
import { Button, Input, Textarea } from "@beyond/design-system"

type Props = {
  deck: {
    id: string
    title: string
    description: string | null
  }
}

const initialState: DeckActionState = {}

export function DeckMetadataForm({ deck }: Props) {
  const [state, action, pending] = useActionState(updateDeck, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="deckId" value={deck.id} />

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
          defaultValue={deck.title}
          required
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
          defaultValue={deck.description ?? ""}
          rows={2}
        />
      </div>

      <Button type="submit" size="sm" disabled={pending} className="self-end">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}
