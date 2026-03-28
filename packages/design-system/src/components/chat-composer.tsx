import type { FormEvent, ReactNode } from "react"

import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"

export type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  placeholder?: string
  disabled?: boolean
  submitLabel?: string
  /** e.g. a Stop button while streaming */
  leadingActions?: ReactNode
  textareaRows?: number
  textareaClassName?: string
  actionsClassName?: string
  formClassName?: string
}

const defaultTextareaClass =
  "min-h-13 resize-none rounded-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/75"

/**
 * Bottom-aligned prompt field with primary submit; optional slot for extra actions.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  submitLabel = "Send",
  leadingActions,
  textareaRows = 2,
  textareaClassName,
  actionsClassName,
  formClassName,
}: ChatComposerProps) {
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit()
  }

  const canSubmit = !disabled && value.trim().length > 0

  return (
    <form
      className={cn("shrink-0 border-t border-border", formClassName)}
      onSubmit={handleSubmit}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textareaRows}
        disabled={disabled}
        className={cn(defaultTextareaClass, textareaClassName)}
      />
      <div
        className={cn(
          "flex items-center justify-end gap-2 px-2 py-2",
          actionsClassName,
        )}
      >
        {leadingActions}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
