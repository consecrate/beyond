"use client"

import { useCallback, useState } from "react"

import { LessonMetadataForm } from "@/features/lessons/components/lesson-metadata-form"
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SettingsGearIcon,
} from "@beyond/design-system"

type Props = {
  lesson: {
    id: string
    session_id: string
    title: string | null
    goal_text: string | null
    lesson_markdown: string | null
  }
}

export function EditLessonDialog({ lesson }: Props) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const onSaved = useCallback(() => setOpen(false), [])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setFormKey((k) => k + 1)
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 text-muted-foreground hover:text-foreground")}
            aria-label="Lesson settings"
          />
        }
      >
        <SettingsGearIcon className="size-5" aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lesson details</DialogTitle>
          <DialogDescription>
            A lesson is your persistent workspace for goals, the skill graph, and practice.
          </DialogDescription>
        </DialogHeader>

        <LessonMetadataForm
          key={formKey}
          lesson={lesson}
          appearance="dialog"
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}
