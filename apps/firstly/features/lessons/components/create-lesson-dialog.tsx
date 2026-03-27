"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"

import { createLesson, type LessonActionState } from "@/features/lessons/actions"
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

const initialState: LessonActionState = {}

type Props = {
  triggerClassName?: string
  variant?: "default" | "slim" | "tile"
}

function CreateLessonForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState(createLesson, initialState)
  const wasPending = useRef(false)

  useEffect(() => {
    if (pending) {
      wasPending.current = true
      return
    }
    if (!wasPending.current) return
    wasPending.current = false
    if (!state.error) onSuccess()
  }, [pending, state.error, onSuccess])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="entryMode" value="topic" />

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonTitle" className="text-sm font-medium">
          Title
        </label>
        <Input
          id="lessonTitle"
          name="title"
          required
          placeholder="Limits and continuity"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lessonGoal" className="text-sm font-medium">
          Goal{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="lessonGoal"
          name="goalText"
          placeholder="What you want to understand or be able to do"
          rows={2}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create lesson"}
      </Button>
    </form>
  )
}

export function CreateLessonDialog({ triggerClassName, variant = "default" }: Props) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const onCreated = useCallback(() => setOpen(false), [])

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
              New lesson
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
        New lesson
      </Button>
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setFormKey((k) => k + 1)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a lesson</DialogTitle>
          <DialogDescription>
            A lesson is your persistent workspace for goals, the skill graph, and practice.
          </DialogDescription>
        </DialogHeader>

        <CreateLessonForm key={formKey} onSuccess={onCreated} />
      </DialogContent>
    </Dialog>
  )
}
