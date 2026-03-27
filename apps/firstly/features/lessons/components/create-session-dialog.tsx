"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"

import {
  createSession,
  updateSession,
  type LessonActionState,
} from "@/features/lessons/actions"
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
  SettingsGearIcon,
  Textarea,
} from "@beyond/design-system"
import { Plus } from "lucide-react"

const initialState: LessonActionState = {}

type Props = {
  triggerClassName?: string
  variant?: "default" | "slim" | "tile"
  edit?: {
    sessionId: string
    title: string
    /** When set, the form includes the root lesson goal field (same row as session’s first lesson). */
    rootLesson?: { goalText: string | null }
  }
}

function SessionForm({
  mode,
  edit,
  onSuccess,
}: {
  mode: "create" | "edit"
  edit?: Props["edit"]
  onSuccess: () => void
}) {
  const actionFn = mode === "edit" ? updateSession : createSession
  const [state, action, pending] = useActionState(actionFn, initialState)
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

  const titleId = mode === "edit" ? "sessionTitleEdit" : "sessionTitle"
  const goalId = "sessionGoalEdit"
  const showGoal = mode === "edit" && edit?.rootLesson != null

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "edit" ? <input type="hidden" name="sessionId" value={edit!.sessionId} /> : null}

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-sm font-medium">
          Title
        </label>
        <Input
          id={titleId}
          name="title"
          required
          placeholder="Limits and continuity"
          defaultValue={mode === "edit" ? edit!.title : undefined}
        />
      </div>

      {showGoal ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={goalId} className="text-sm font-medium">
            Goal for first lesson{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={goalId}
            name="goalText"
            placeholder="What you want to understand or be able to do"
            rows={2}
            defaultValue={edit!.rootLesson!.goalText ?? undefined}
          />
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending
          ? mode === "edit"
            ? "Saving…"
            : "Creating…"
          : mode === "edit"
            ? "Save changes"
            : "Create session"}
      </Button>
    </form>
  )
}

export function CreateSessionDialog({
  triggerClassName,
  variant = "default",
  edit,
}: Props) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const onCreated = useCallback(() => setOpen(false), [])
  const isEdit = edit != null

  const trigger = isEdit ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "shrink-0 text-muted-foreground hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring",
        triggerClassName,
      )}
      aria-label="Edit session"
    >
      <SettingsGearIcon className="size-5" aria-hidden />
    </Button>
  ) : variant === "tile" ? (
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
              New session
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
        New session
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
          <DialogTitle>{isEdit ? "Edit session" : "Create a session"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? edit?.rootLesson != null
                ? "Update the session title and the goal for the first lesson."
                : "Update the session title."
              : "A session is your workspace. Lessons are added separately when you need them."}
          </DialogDescription>
        </DialogHeader>

        <SessionForm
          key={`${isEdit ? edit.sessionId : "new"}-${formKey}`}
          mode={isEdit ? "edit" : "create"}
          edit={edit}
          onSuccess={onCreated}
        />
      </DialogContent>
    </Dialog>
  )
}
