"use client"

import { useEffect, useId, useRef, useState } from "react"

import { signOut } from "@/features/auth/actions"
import { Button, cn, SettingsGearIcon } from "@beyond/design-system"

type Props = {
  displayName: string
  email: string
}

export function AppUserMenu({ displayName, email }: Props) {
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
    <div ref={menuRef} className="relative flex shrink-0 flex-col items-center">
      <Button
        type="button"
        id={`${menuPanelId}-trigger`}
        variant="ghost"
        size="icon-sm"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls={menuPanelId}
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          "shrink-0 text-muted-foreground hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label="Account menu"
      >
        <SettingsGearIcon className="size-5" aria-hidden />
      </Button>
      {menuOpen ? (
        <div
          id={menuPanelId}
          aria-labelledby={`${menuPanelId}-trigger`}
          className={cn(
            "absolute top-full right-0 z-50 mt-1.5 w-[min(10.5rem,calc(100vw-1rem))] rounded-md",
            "border border-border/50 bg-background p-px",
            "shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
          )}
        >
          <div
            className={cn(
              "overflow-hidden rounded-[calc(var(--radius-md)-1px)] bg-popover text-popover-foreground"
            )}
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium leading-tight text-foreground">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                {email}
              </p>
            </div>
            <div className="h-px bg-border/60" role="separator" />
            <form action={signOut}>
              <button
                type="submit"
                className={cn(
                  "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-xs font-normal leading-none",
                  "text-foreground outline-none transition-colors",
                  "hover:bg-muted/50 focus-visible:bg-muted/50 active:bg-muted/65"
                )}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
