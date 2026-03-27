"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { Home, PieChart, type LucideIcon } from "lucide-react"

import { signOut } from "@/features/presenter-auth/actions"
import { cn } from "@beyond/design-system"

type Props = {
  displayName: string
  email: string
}

export function PresenterSidebar({ displayName, email }: Props) {
  const pathname = usePathname()
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
    <aside
      className={cn(
        "flex h-auto w-full shrink-0 flex-row items-stretch justify-between gap-0 border-border bg-background",
        "border-b md:h-svh md:w-19 md:flex-col md:justify-start md:border-r md:border-b-0"
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-row items-center gap-1 px-1 py-2 md:flex-col md:items-stretch md:justify-start md:gap-0 md:px-0 md:py-0">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-row items-center gap-1 overflow-x-auto overscroll-x-contain",
            "md:min-h-0 md:flex-1 md:flex-col md:items-stretch md:justify-start md:gap-0 md:overflow-y-auto md:py-3"
          )}
        >
          <nav
            className="flex flex-row items-center justify-around gap-0.5 md:flex-col md:gap-1 md:px-1"
            aria-label="Presenter"
          >
            <SlimNavLink
              href="/presenter/decks"
              active={pathname === "/presenter/decks"}
              icon={Home}
              label="Home"
            />
            <SlimNavSlot icon={PieChart} label="Sessions" />
          </nav>

          <div
            className="mx-0.5 hidden min-h-px min-w-px flex-1 md:block"
            aria-hidden
          />
        </div>

        <div className="flex shrink-0 flex-row items-center gap-0.5 md:flex-col md:gap-2 md:pb-2">
          <div
            ref={menuRef}
            className="relative flex flex-col items-center"
          >
            <button
              type="button"
              id={`${menuPanelId}-trigger`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-controls={menuPanelId}
              onClick={() => setMenuOpen((o) => !o)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1 outline-none select-none",
                "rounded-md focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-[11px] font-semibold tracking-tight text-foreground shadow-sm"
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
                  "absolute bottom-full left-0 z-50 mb-1.5 w-[min(10.5rem,calc(100vw-1rem))] rounded-md",
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
        </div>
      </div>
    </aside>
  )
}

function SlimNavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string
  active: boolean
  icon: LucideIcon
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-13 flex-col items-center gap-0.5 rounded-sm px-1 py-2 text-[11px] leading-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "font-semibold text-foreground"
          : "font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-sm transition-[box-shadow,background-color]",
          active
            ? "border border-border bg-card text-foreground"
            : "bg-transparent"
        )}
      >
        <Icon
          className="size-4.5"
          strokeWidth={active ? 2.25 : 1.35}
          aria-hidden
        />
      </span>
      <span className="max-w-17 text-center">{label}</span>
    </Link>
  )
}

function SlimNavSlot({
  icon: Icon,
  label,
}: {
  icon: LucideIcon
  label: string
}) {
  return (
    <span
      className="flex min-w-13 flex-col items-center gap-0.5 rounded-sm px-1 py-2 text-[11px] leading-tight text-muted-foreground/45"
      title="Coming soon"
    >
      <span
        className="flex size-8 items-center justify-center rounded-sm"
        aria-hidden
      >
        <Icon className="size-4.5" strokeWidth={1.35} aria-hidden />
      </span>
      <span className="max-w-17 text-center">
        {label}
        <span className="sr-only"> — coming soon</span>
      </span>
    </span>
  )
}
