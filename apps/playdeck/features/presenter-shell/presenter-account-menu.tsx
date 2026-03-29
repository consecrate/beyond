"use client"

import { useEffect, useId, useRef, useState } from "react"

import { useLogOut } from "jazz-tools/react"

import { cn } from "@beyond/design-system"

type Props = {
  displayName: string
  /** Optional; passkeys do not provide email. */
  email?: string | null
}

export function PresenterAccountMenu({ displayName, email }: Props) {
  const logOut = useLogOut()
  const initial = displayName.trim().charAt(0).toUpperCase() || "?"
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPanelId = useId()

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  return (
    <div ref={menuRef} className="relative flex items-center">
      <button
        type="button"
        id={`${menuPanelId}-trigger`}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls={menuPanelId}
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          "flex cursor-pointer items-center justify-center outline-none select-none",
          "rounded-md focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-[11px] font-semibold tracking-tight text-foreground shadow-sm"
          aria-hidden
        >
          {initial}
        </span>
        <span className="sr-only">Account menu</span>
      </button>
      {menuOpen ? (
        <div
          id={menuPanelId}
          aria-labelledby={`${menuPanelId}-trigger`}
          className={cn(
            "absolute top-full right-0 z-50 mt-1.5 w-[min(10.5rem,calc(100vw-1rem))] rounded-md",
            "border border-border/50 bg-background p-px",
            "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.04)]",
          )}
        >
          <div
            className={cn(
              "overflow-hidden rounded-[calc(var(--radius-md)-1px)] bg-popover text-popover-foreground",
            )}
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium leading-tight text-foreground">
                {displayName}
              </p>
              {email ? (
                <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                  {email}
                </p>
              ) : (
                <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                  Passkey account
                </p>
              )}
            </div>
            <div className="h-px bg-border/60" role="separator" />
            <button
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-xs font-normal leading-none",
                "text-foreground outline-none transition-colors",
                "hover:bg-muted/50 focus-visible:bg-muted/50 active:bg-muted/65",
              )}
              onClick={() => {
                setMenuOpen(false)
                logOut()
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
