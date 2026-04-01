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
import {
  claimBattlePowerup,
  clearBattlePowerupClaim,
  confirmBattlePowerupClaim,
} from "@/features/jazz/live-session-mutations"
import { POWERUP_CATALOG, formatPowerupLabel } from "@/features/slides/powerup-meta"
import { Button } from "@beyond/design-system"
import { Check, Loader2, Sparkles, X } from "lucide-react"

function selectionForTeam(
  liveSession: Loaded<typeof LiveSession>,
  teamId: string,
): Loaded<typeof BattlePowerupSelection> | null {
  const bs = liveSession.battle_state
  if (!bs || !bs.$isLoaded) return null
  const list = bs.powerup_selections
  if (!list || !list.$isLoaded) return null
  for (const s of list) {
    if (s && s.$isLoaded && s.team_id === teamId) return s
  }
  return null
}

function isTypeHeldByOtherTeam(
  liveSession: Loaded<typeof LiveSession>,
  myTeamId: string,
  powerupType: z.infer<typeof PowerupType>,
): boolean {
  const bs = liveSession.battle_state
  if (!bs || !bs.$isLoaded) return false
  const list = bs.powerup_selections
  if (!list || !list.$isLoaded) return false
  for (const s of list) {
    if (!s || !s.$isLoaded) continue
    if (s.team_id === myTeamId) continue
    if (s.powerup_type === powerupType) return true
  }
  return false
}

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
  const isLeader = myTeam.leader_account_id === userId

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

  const mySelection = selectionForTeam(liveSession, myTeam.id)

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

  const confirm = () => {
    setErr(null)
    start(() => {
      if (!me.$isLoaded) return
      const res = confirmBattlePowerupClaim(me, liveSession)
      if (!res.ok) setErr(res.error)
    })
  }

  const healOptions = teams.filter(
    (t) => t.id !== myTeam.id && (t.hp ?? 0) > 0 && t.status !== "downed",
  )

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
        Round power-up
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {isLeader
          ? "A teammate picks an item from their inventory. You confirm before the round starts."
          : "Pick one power-up you own. Your leader must confirm it."}
      </p>

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {err}
        </p>
      ) : null}

      {mySelection && mySelection.$isLoaded ? (
        <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">
            {formatPowerupLabel(mySelection.powerup_type)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({mySelection.status === "confirmed" ? "Confirmed" : "Pending"})
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Picked by {resolvePlayerName(mySelection.picker_account_id)}
          </p>
          {mySelection.powerup_type === "healing_potion" && mySelection.healing_target_team_id ? (
            <p className="text-xs text-muted-foreground">
              Heal →{" "}
              {teams.find((t) => t.id === mySelection.healing_target_team_id)?.name ?? "?"}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">No power-up chosen yet.</p>
      )}

      {!isLeader && mySelection?.status !== "confirmed" ? (
        <div className="flex flex-col gap-2">
          {mySelection?.status === "pending" && mySelection.picker_account_id !== userId ? (
            <p className="text-sm text-muted-foreground">
              {resolvePlayerName(mySelection.picker_account_id)} is choosing — only they can change
              or clear the pick.
            </p>
          ) : null}
          {!(
            mySelection?.status === "pending" &&
            mySelection.picker_account_id !== userId
          )
            ? POWERUP_CATALOG.map((entry) => {
            const owned = ownedByType.get(entry.type) ?? 0
            const blockedGlobally = isTypeHeldByOtherTeam(liveSession, myTeam.id, entry.type)
            const canPick = owned > 0 && !blockedGlobally
            const showHealSelect = entry.type === "healing_potion"

            return (
              <div key={entry.type} className="flex flex-col gap-1 rounded-md border border-border/60 bg-background/50 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({owned} on you)</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      pending ||
                      !canPick ||
                      (showHealSelect && !healTargetId) ||
                      Boolean(
                        mySelection?.status === "pending" &&
                          mySelection.picker_account_id !== userId,
                      )
                    }
                    className="rounded-none"
                    onClick={() => claim(entry.type)}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{entry.desc}</p>
                {showHealSelect ? (
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Heal which team?</span>
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-foreground"
                      value={healTargetId}
                      onChange={(e) => setHealTargetId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {healOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {blockedGlobally ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Another team is holding this type — wait or pick something else.
                  </p>
                ) : null}
              </div>
            )
          })
            : null}
          {mySelection?.status === "pending" && mySelection.picker_account_id === userId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={pending}
              onClick={clear}
            >
              <X className="mr-1.5 h-4 w-4" />
              Clear pick (frees type for others)
            </Button>
          ) : null}
        </div>
      ) : null}

      {isLeader && mySelection?.status === "pending" ? (
        <Button
          type="button"
          className="w-full rounded-none"
          disabled={pending}
          onClick={confirm}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Confirm power-up
            </>
          )}
        </Button>
      ) : null}

      {isLeader && mySelection?.status === "confirmed" ? (
        <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Power-up locked for this round.
        </p>
      ) : null}
    </div>
  )
}
