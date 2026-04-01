"use client"

import { useMemo, useState, useTransition } from "react"
import type { Loaded } from "jazz-tools"
import type { z } from "jazz-tools"

import type {
  BattlePowerupSelection,
  LiveSession,
  PlaydeckAccount,
  Powerup,
  PowerupType,
  SessionPlayer,
  Team,
} from "@/features/jazz/schema"
import { claimBattlePowerup, clearBattlePowerupClaim } from "@/features/jazz/live-session-mutations"
import { POWERUP_CATALOG } from "@/features/slides/powerup-meta"
import { Button, cn } from "@beyond/design-system"
import { Loader2, Sparkles, X } from "lucide-react"

// ---------------------------------------------------------------------------
// Color accent helpers — maps the catalog colorToken to Tailwind utility classes
// so we keep a single place to update if tokens change.
// ---------------------------------------------------------------------------
const COLOR_CLASSES: Record<
  string,
  { border: string; bg: string; icon: string; badge: string; owned: string }
> = {
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-500",
    badge: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    owned: "text-amber-600 dark:text-amber-400",
  },
  sky: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/10",
    icon: "bg-sky-500/15 text-sky-500",
    badge: "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    owned: "text-sky-600 dark:text-sky-400",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    owned: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    icon: "bg-rose-500/15 text-rose-500",
    badge: "bg-rose-500/20 text-rose-600 dark:text-rose-400",
    owned: "text-rose-600 dark:text-rose-400",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/10",
    icon: "bg-violet-500/15 text-violet-500",
    badge: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    owned: "text-violet-600 dark:text-violet-400",
  },
  orange: {
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    icon: "bg-orange-500/15 text-orange-500",
    badge: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    owned: "text-orange-600 dark:text-orange-400",
  },
  pink: {
    border: "border-pink-500/30",
    bg: "bg-pink-500/10",
    icon: "bg-pink-500/15 text-pink-500",
    badge: "bg-pink-500/20 text-pink-600 dark:text-pink-400",
    owned: "text-pink-600 dark:text-pink-400",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    icon: "bg-red-500/15 text-red-500",
    badge: "bg-red-500/20 text-red-600 dark:text-red-400",
    owned: "text-red-600 dark:text-red-400",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function selectionForMember(
  liveSession: Loaded<typeof LiveSession>,
  teamId: string,
  accountId: string,
): Loaded<typeof BattlePowerupSelection> | null {
  const bs = liveSession.battle_state
  if (!bs || !bs.$isLoaded) return null
  const list = bs.powerup_selections
  if (!list || !list.$isLoaded) return null
  for (const s of list) {
    if (
      s &&
      s.$isLoaded &&
      s.team_id === teamId &&
      s.picker_account_id === accountId
    ) {
      return s
    }
  }
  return null
}

/**
 * HP-boosting types that multiple teammates may each pick once per round.
 * All other types are capped at one picker per team.
 */
const STACKABLE_POWERUP_TYPES = new Set(["healing_potion", "step_up"])

/**
 * Returns true if a teammate (same team, different account) has already claimed this
 * powerup type this round AND the type is not stackable.
 */
function isTypeTakenByTeammate(
  liveSession: Loaded<typeof LiveSession>,
  myTeamId: string,
  myAccountId: string,
  powerupType: z.infer<typeof PowerupType>,
): boolean {
  if (STACKABLE_POWERUP_TYPES.has(powerupType)) return false
  const bs = liveSession.battle_state
  if (!bs || !bs.$isLoaded) return false
  const list = bs.powerup_selections
  if (!list || !list.$isLoaded) return false
  for (const s of list) {
    if (!s || !s.$isLoaded) continue
    if (s.team_id !== myTeamId) continue
    if (s.picker_account_id === myAccountId) continue
    if (s.powerup_type === powerupType) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type BattlePowerupRoundPanelProps = {
  liveSession: Loaded<typeof LiveSession>
  me: Loaded<typeof PlaydeckAccount>
  teams: Loaded<typeof Team>[]
  myTeam: Loaded<typeof Team>
}

export function BattlePowerupRoundPanel({
  liveSession,
  me,
  teams,
  myTeam,
}: BattlePowerupRoundPanelProps) {
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [healTargetId, setHealTargetId] = useState<string>("")

  const userId = me.$jazz.id

  const teamPowerups = useMemo(() => {
    const list = myTeam.powerups
    if (!list || !list.$isLoaded) return [] as Loaded<typeof Powerup>[]
    return [...list].filter((pu): pu is Loaded<typeof Powerup> => !!(pu && pu.$isLoaded))
  }, [myTeam.powerups])

  /** Unused powerups owned by current user, grouped by type. */
  const ownedByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const pu of teamPowerups) {
      if (pu.owner_account_id !== userId || pu.is_used) continue
      m.set(pu.type, (m.get(pu.type) ?? 0) + 1)
    }
    return m
  }, [teamPowerups, userId])

  const mySelection = selectionForMember(liveSession, myTeam.id, userId)

  const resolvePlayerName = (accountId: string): string => {
    const players = liveSession.joined_players
    if (!players?.$isLoaded) return "Teammate"
    const p = [...players].find(
      (x): x is Loaded<typeof SessionPlayer> =>
        !!(x && x.$isLoaded && x.account_id === accountId),
    )
    return p?.name ?? "Teammate"
  }

  const claim = (type: z.infer<typeof PowerupType>) => {
    setErr(null)
    start(() => {
      if (!me.$isLoaded) return
      const res = claimBattlePowerup(me, liveSession, {
        powerupType: type,
        healingTargetTeamId:
          type === "healing_potion" ? healTargetId || undefined : undefined,
      })
      if (!res.ok) setErr(res.error)
    })
  }

  const clear = () => {
    setErr(null)
    start(() => {
      if (!me.$isLoaded) return
      const res = clearBattlePowerupClaim(me, liveSession)
      if (!res.ok) setErr(res.error)
    })
  }

  const healOptions = teams.filter(
    (t) => t.id !== myTeam.id && (t.hp ?? 0) > 0 && t.status !== "downed",
  )

  // Find the catalog entry for the active selection
  const activeEntry = mySelection
    ? POWERUP_CATALOG.find((e) => e.type === mySelection.powerup_type)
    : null
  const activeColors = activeEntry ? (COLOR_CLASSES[activeEntry.colorToken] ?? COLOR_CLASSES.amber) : null

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
        <span className="text-sm font-bold uppercase tracking-widest text-foreground opacity-80">
          Round Power-up
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Pick one power-up from your inventory to deploy this round.
      </p>

      {/* Error */}
      {err ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      {/* Active selection badge */}
      {mySelection && mySelection.$isLoaded && activeEntry && activeColors ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border-2 px-4 py-3",
            activeColors.border,
            activeColors.bg,
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl",
              activeColors.icon,
            )}
          >
            <activeEntry.Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{activeEntry.name}</p>
            <p className="text-xs text-muted-foreground">
              by {resolvePlayerName(mySelection.picker_account_id)}
              {mySelection.powerup_type === "healing_potion" && mySelection.healing_target_team_id
                ? ` → Heal ${teams.find((t) => t.id === mySelection.healing_target_team_id)?.name ?? "?"}`
                : ""}
            </p>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", activeColors.badge)}>
            active
          </span>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">No power-up chosen yet.</p>
      )}

      {/* Power-up grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {POWERUP_CATALOG.map((entry) => {
          const owned = ownedByType.get(entry.type) ?? 0
          const blockedByTeammate = isTypeTakenByTeammate(liveSession, myTeam.id, userId, entry.type)
          const needsHealTarget = entry.type === "healing_potion"
          const canPick = owned > 0 && !blockedByTeammate
          const disabled = pending || !canPick || (needsHealTarget && !healTargetId)

          const colors = COLOR_CLASSES[entry.colorToken] ?? COLOR_CLASSES.amber
          const isSelected = mySelection?.$isLoaded && mySelection.powerup_type === entry.type

          return (
            <div key={entry.type} className="flex flex-col gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => claim(entry.type)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                  isSelected
                    ? cn("border-2 shadow-md", colors.border, colors.bg)
                    : canPick && !disabled
                      ? cn(
                          "border-border hover:-translate-y-0.5 hover:shadow-md active:scale-95",
                          `hover:${colors.border}`,
                          `hover:${colors.bg}`,
                        )
                      : "cursor-not-allowed border-border/40 bg-muted/10 opacity-50",
                )}
              >
                {/* Icon */}
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    owned > 0 ? colors.icon : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <entry.Icon className="h-5 w-5" aria-hidden />
                </span>

                {/* Name */}
                <span className="text-sm font-bold leading-tight">{entry.name}</span>

                {/* Desc */}
                <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                  {entry.desc}
                </span>

                {/* Owned badge */}
                <span
                  className={cn(
                    "mt-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
                    owned > 0 ? colors.badge : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {owned > 0 ? `${owned} owned` : "none"}
                </span>

                {/* "Taken" overlay */}
                {blockedByTeammate ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Taken by teammate
                  </span>
                ) : null}
              </button>

              {/* Heal target selector (only for healing_potion) */}
              {needsHealTarget && owned > 0 ? (
                <select
                  className="w-full rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs text-foreground"
                  value={healTargetId}
                  onChange={(e) => setHealTargetId(e.target.value)}
                  aria-label="Heal which team?"
                >
                  <option value="">Heal who?</option>
                  {healOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Clear selection */}
      {mySelection?.status === "confirmed" && mySelection.picker_account_id === userId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl"
          disabled={pending}
          onClick={clear}
        >
          <X className="mr-1.5 h-4 w-4" />
          Clear my pick
        </Button>
      ) : null}

      {/* Loading */}
      {pending ? (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Updating…
        </p>
      ) : null}
    </div>
  )
}
