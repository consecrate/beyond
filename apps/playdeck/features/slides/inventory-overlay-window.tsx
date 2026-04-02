"use client"

import type { Loaded } from "jazz-tools"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@beyond/design-system"
import { Package } from "lucide-react"

import type { LiveSession, Powerup, SessionPlayer } from "@/features/jazz/schema"
import { formatPowerupLabel, POWERUP_CATALOG } from "@/features/slides/powerup-meta"

export type InventoryOverlayWindowProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  hasTeam: boolean
  /** Powerups assigned to the current user and not used. */
  myPowerups: Loaded<typeof Powerup>[]
  /** All team powerups (for overview). */
  teamPowerups: Loaded<typeof Powerup>[]
  liveSession: Loaded<typeof LiveSession>
  teamName?: string
}

export function InventoryOverlayWindow({
  open,
  onOpenChange,
  userId,
  hasTeam,
  myPowerups,
  teamPowerups,
  liveSession,
  teamName,
}: InventoryOverlayWindowProps) {
  const resolveName = (accountId: string): string => {
    const players = liveSession.joined_players
    if (!players?.$isLoaded) return "Member"
    const p = Array.from(players).find(
      (x): x is Loaded<typeof SessionPlayer> =>
        !!(x && x.$isLoaded && x.account_id === accountId),
    )
    return p?.name ?? "Member"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,900px)] max-w-lg overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden />
            Inventory
          </DialogTitle>
          <DialogDescription>
            Powerups you bought with your PlayPoints, plus your team overview.
          </DialogDescription>
        </DialogHeader>

        {!hasTeam ? (
          <p className="text-sm text-muted-foreground">
            Join a team to see your inventory.
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Your powerups
                {teamName ? (
                  <span className="ml-1.5 font-medium normal-case tracking-normal text-muted-foreground/70">
                    ({teamName})
                  </span>
                ) : null}
              </h3>
              {myPowerups.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/5 py-8">
                  <p className="text-sm italic text-muted-foreground">No powerups assigned to you yet.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {myPowerups.map((pu, i) => {
                    const meta = POWERUP_CATALOG.find(p => p.type === pu.type)
                    const Icon = meta?.Icon
                    const label = meta?.name ?? formatPowerupLabel(pu.type)

                    return (
                      <div
                        key={i}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                          pu.is_used
                            ? "border-border/40 bg-muted/20 text-muted-foreground/50"
                            : "border-primary/20 bg-primary/5 text-foreground shadow-sm hover:border-primary/30 hover:bg-primary/10"
                        }`}
                      >
                        {Icon ? <Icon className="h-4 w-4" /> : null}
                        <span className="capitalize">{label}</span>
                        {pu.is_used ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            (Used)
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Team inventory
              </h3>
              {teamPowerups.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/5 py-8">
                  <p className="text-sm italic text-muted-foreground">No team powerups yet.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {Array.from(
                    teamPowerups.reduce((acc, pu) => {
                      acc.set(pu.type, (acc.get(pu.type) ?? 0) + 1)
                      return acc
                    }, new Map<string, number>()).entries()
                  ).map(([type, count], i) => {
                      const meta = POWERUP_CATALOG.find(p => p.type === type)
                      const Icon = meta?.Icon
                      const label = meta?.name ?? formatPowerupLabel(type as any)

                      return (
                        <div
                          key={i}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border/60 bg-muted/10 px-4 py-1.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-muted/20"
                        >
                          {Icon ? <Icon className="h-4 w-4 text-muted-foreground/80" /> : null}
                          <span className="capitalize">{label}</span>
                          {count > 1 && (
                            <span className="ml-1 font-semibold text-muted-foreground/70">
                              x{count}
                            </span>
                          )}
                        </div>
                      )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
