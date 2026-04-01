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
import { formatPowerupLabel } from "@/features/slides/powerup-meta"

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
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your powerups
                {teamName ? (
                  <span className="ml-1 font-normal normal-case text-muted-foreground/80">
                    ({teamName})
                  </span>
                ) : null}
              </h3>
              {myPowerups.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No powerups assigned to you yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {myPowerups.map((pu, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium capitalize"
                    >
                      {formatPowerupLabel(pu.type)}
                      {pu.is_used ? (
                        <span className="ml-2 text-xs text-muted-foreground">(used)</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Team inventory
              </h3>
              {teamPowerups.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No team powerups yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {teamPowerups.map((pu, i) => {
                    const isMe = pu.owner_account_id === userId
                    return (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="font-medium capitalize">{formatPowerupLabel(pu.type)}</span>
                        <span className="text-xs text-muted-foreground">
                          {isMe ? "You" : resolveName(pu.owner_account_id)}
                          {pu.is_used ? " · used" : ""}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
