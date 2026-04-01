"use client"

import type { Loaded } from "jazz-tools"
import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@beyond/design-system"
import { Star } from "lucide-react"
import type { z } from "jazz-tools"

import type { LiveSession, Powerup, SessionPlayer, Team } from "@/features/jazz/schema"
import type { PowerupType } from "@/features/jazz/schema"
import { POWERUP_CATALOG, formatPowerupLabel } from "@/features/slides/powerup-meta"

export type PowerupStoreCatalogProps = {
  /** When false, buy buttons are disabled and catalog is view-only. */
  canPurchase: boolean
  /** Optional banner when purchases are disabled (wrong role or wrong phase). */
  readOnlyNotice: string | null
  /** Current viewer's personal PlayPoints (purchases debit this, not the team pool). */
  myPlayPoints: number
  teamPowerups: Loaded<typeof Powerup>[]
  liveSession: Loaded<typeof LiveSession>
  buyError: string | null
  buyPending: boolean
  onBuy: (type: z.infer<typeof PowerupType>, cost: number) => void
  /** 'fullscreen' matches existing full-screen store layout; 'embed' is tighter for dialogs. */
  variant: "fullscreen" | "embed"
}

export function PowerupStoreCatalog({
  canPurchase,
  readOnlyNotice,
  myPlayPoints,
  teamPowerups,
  liveSession,
  buyError,
  buyPending,
  onBuy,
  variant,
}: PowerupStoreCatalogProps) {
  const isEmbed = variant === "embed"

  const resolveMember = (accountId: string): Loaded<typeof SessionPlayer> | undefined => {
    const players = liveSession.joined_players
    if (!players?.$isLoaded) return undefined
    return Array.from(players).find(
      (p): p is Loaded<typeof SessionPlayer> =>
        !!(p && p.$isLoaded && p.account_id === accountId),
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        isEmbed ? "w-full" : "mx-auto w-full max-w-4xl items-center",
      )}
    >
      {!isEmbed ? (
        <div className="w-full text-center">
          <h2 className="bg-linear-to-r from-amber-400 to-orange-600 bg-clip-text text-4xl font-black uppercase tracking-widest text-transparent">
            Powerup Store
          </h2>
          <p className="mt-2 font-medium text-muted-foreground">Equip your team for the battle ahead.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Browse the catalog. Purchases follow the rules above.
        </p>
      )}

      {readOnlyNotice ? (
        <p className="w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          {readOnlyNotice}
        </p>
      ) : null}

      <div className={cn("flex items-center gap-4", !isEmbed && "mb-4")}>
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-3">
          <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
          <span className="text-2xl font-bold text-amber-500">{myPlayPoints}</span>
          <span className="ml-1 mt-1 text-sm font-semibold uppercase tracking-widest text-amber-500 opacity-70">
            Your PP
          </span>
        </div>
      </div>

      {buyError ? (
        <p className="w-full rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center font-medium text-destructive">
          {buyError}
        </p>
      ) : null}

      <div
        className={cn(
          "grid w-full gap-4",
          isEmbed ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
        )}
      >
        {POWERUP_CATALOG.map((pu) => {
          const canAfford = myPlayPoints >= pu.cost
          const disabled = buyPending || !canPurchase || !canAfford
          return (
            <button
              key={pu.type}
              type="button"
              disabled={disabled}
              onClick={() => onBuy(pu.type, pu.cost)}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-300",
                canPurchase && canAfford
                  ? "border-border bg-card hover:-translate-y-1 hover:border-primary/50 hover:bg-muted/50 hover:shadow-lg active:scale-95"
                  : "cursor-not-allowed border-border/50 bg-muted/20 opacity-60",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <h3 className="text-base font-bold leading-tight">{pu.name}</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-xs font-bold",
                    canAfford ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground",
                  )}
                >
                  {pu.cost} PP
                </span>
              </div>
              <p className="text-xs leading-snug text-muted-foreground">{pu.desc}</p>
            </button>
          )
        })}
      </div>

      {teamPowerups.length > 0 ? (
        <div className="mt-2 w-full rounded-2xl border border-border bg-card/50 p-6">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest opacity-70">
            Team inventory
          </h3>
          <div className="flex flex-wrap gap-2">
            {teamPowerups.map((pu, i) => {
              const member = resolveMember(pu.owner_account_id)
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium"
                >
                  <span className="capitalize">{formatPowerupLabel(pu.type)}</span>
                  <span className="opacity-40">→</span>
                  <span className="max-w-[100px] truncate font-semibold text-primary">
                    {member ? member.name : "Member"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export type ShopOverlayWindowProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gamePhase: string
  hasTeam: boolean
  myPlayPoints: number
  myTeam: Loaded<typeof Team> | undefined
  teamPowerups: Loaded<typeof Powerup>[]
  liveSession: Loaded<typeof LiveSession>
  buyError: string | null
  buyPending: boolean
  onBuy: (type: z.infer<typeof PowerupType>, cost: number) => void
}

export function ShopOverlayWindow({
  open,
  onOpenChange,
  gamePhase,
  hasTeam,
  myPlayPoints,
  myTeam,
  teamPowerups,
  liveSession,
  buyError,
  buyPending,
  onBuy,
}: ShopOverlayWindowProps) {
  const inStorePhase = gamePhase === "store"
  const canPurchase = hasTeam && inStorePhase
  let readOnlyNotice: string | null = null
  if (!hasTeam) {
    readOnlyNotice = "Join a team to use the shop."
  } else if (!inStorePhase) {
    readOnlyNotice = "Purchases are only available during the store phase."
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,900px)] max-w-4xl overflow-y-auto sm:max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle>Shop</DialogTitle>
          <DialogDescription>
            Buy with your own PlayPoints during the store phase. Items go to your inventory.
          </DialogDescription>
        </DialogHeader>
        {hasTeam && myTeam ? (
          <PowerupStoreCatalog
            variant="embed"
            canPurchase={canPurchase}
            readOnlyNotice={readOnlyNotice}
            myPlayPoints={myPlayPoints}
            teamPowerups={teamPowerups}
            liveSession={liveSession}
            buyError={buyError}
            buyPending={buyPending}
            onBuy={onBuy}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Join a team when team formation opens to access the shop.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
