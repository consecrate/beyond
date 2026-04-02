"use client"

import { useState, useTransition } from "react"
import type { Loaded } from "jazz-tools"

import type {
  LiveSession,
  PlaydeckAccount,
  SessionPlayer,
  Team,
} from "@/features/jazz/schema"
import {
  getBattleLockedMap,
  getBattleTargetsMap,
} from "@/features/jazz/battle-state-targets"
import { lockBattleTeam, selectBattleTarget } from "@/features/jazz/live-session-mutations"
import {
  BattlePowerupRoundPanel,
} from "@/features/slides/battle-powerup-round-panel"
import { cn } from "@beyond/design-system"
import { Check, Crosshair, Loader2, Shield, Zap, Lock, Unlock } from "lucide-react"

export type BattleRoyaleAudienceProps = {
  liveSession: Loaded<typeof LiveSession>
  me: Loaded<typeof PlaydeckAccount>
  myPlayerRecord: Loaded<typeof SessionPlayer> | null
  teams: Loaded<typeof Team>[]
}

export function BattleRoyaleAudience({
  liveSession,
  me,
  myPlayerRecord,
  teams,
}: BattleRoyaleAudienceProps) {
  const [targetError, setTargetError] = useState<string | null>(null)
  const [targetPending, startTargeting] = useTransition()

  const [lockPending, startLocking] = useTransition()

  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-background p-6">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Syncing battle…</p>
      </div>
    )
  }

  const phase = battleState.phase ?? "target_selection"
  const targets = getBattleTargetsMap(battleState)
  const lockedTeams = getBattleLockedMap(battleState)

  const myTeam = myPlayerRecord?.team_id
    ? teams.find((t) => t.id === myPlayerRecord.team_id)
    : null
  const isLeader = myTeam && myTeam.leader_account_id === me.$jazz.id

  if (!myTeam) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
        <p className="text-lg font-medium text-foreground">
          You are not in a team. Spectating…
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          You can still follow the presentation on this slide.
        </p>
      </div>
    )
  }

  const isDown = myTeam.hp === undefined || myTeam.hp <= 0

  if (isDown) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="rounded-full border border-border bg-muted p-6">
          <Shield className="h-14 w-14 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Your team is down
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Don&apos;t worry — a team can revive you.
        </p>
      </div>
    )
  }

  const handleSelectTarget = (targetId: string) => {
    setTargetError(null)
    startTargeting(() => {
      if (!me.$isLoaded) return
      const res = selectBattleTarget(me, liveSession, targetId)
      if (!res.ok) setTargetError(res.error)
    })
  }

  const handleLockIn = (isLocked: boolean) => {
    setTargetError(null)
    startLocking(() => {
      if (!me.$isLoaded) return
      const res = lockBattleTeam(me, liveSession, isLocked)
      if (!res.ok) setTargetError(res.error)
    })
  }

  const hasSelectedTarget = !!targets[myTeam.id]
  const isLockedIn = !!lockedTeams[myTeam.id]

  if (phase === "target_selection") {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-auto bg-background px-4 py-8 text-foreground md:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 lg:gap-8">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Battle Royale
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Prepare for Battle
            </h2>
          </div>

          {targetError && isLeader ? (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
              role="alert"
            >
              {targetError}
            </div>
          ) : null}

          {/* Step 1: Target Selection */}
          <section
            className={cn(
              "relative rounded-3xl border-2 p-5 transition-all duration-300 md:p-7",
              hasSelectedTarget
                ? "border-border bg-muted/20"
                : "border-primary/50 bg-card shadow-lg ring-4 ring-primary/10",
            )}
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  Step 1
                </p>
                <h3 className="mt-1 flex items-center gap-2 text-xl font-bold text-foreground">
                  <Crosshair className="h-5 w-5 text-primary" aria-hidden />
                  Select Target
                </h3>
              </div>
              {hasSelectedTarget && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>

            {!hasSelectedTarget ? (
              <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {isLeader
                  ? "Choose which team to attack this round."
                  : "Waiting for your team leader to lock a target..."}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => {
                if (t.id === myTeam.id) return null
                const tDown = t.hp === undefined || t.hp <= 0
                const isSelected = targets[myTeam.id] === t.id
                
                if (hasSelectedTarget && !isSelected) return null

                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!isLeader || tDown || targetPending || hasSelectedTarget || isLockedIn}
                    onClick={() => handleSelectTarget(t.id)}
                    className={cn(
                      "relative flex min-h-[120px] flex-col items-start justify-center gap-2 overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-300",
                      "border-border bg-card text-foreground shadow-sm",
                      tDown && "cursor-not-allowed opacity-40 grayscale",
                      isLeader &&
                        !tDown &&
                        !hasSelectedTarget &&
                        "cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:bg-muted/50 hover:shadow-lg active:scale-95",
                      !isLeader && !hasSelectedTarget && !tDown && "cursor-default",
                      isSelected &&
                        "z-1 border-destructive/60 bg-destructive/10 ring-2 ring-destructive/30",
                      !tDown && !isSelected && t.color,
                      !tDown && !isSelected && "bg-card text-foreground",
                    )}
                  >
                    {isSelected ? (
                      <div
                        className="pointer-events-none absolute inset-0 z-0 bg-destructive/5"
                        aria-hidden
                      />
                    ) : null}
                    <div className="relative z-10 flex w-full flex-col items-start gap-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        {tDown ? (
                          <span className="font-semibold uppercase tracking-wide text-destructive">
                            Down
                          </span>
                        ) : isSelected ? (
                          <>
                            <Crosshair className="h-3.5 w-3.5 text-destructive" />
                            <span className="font-medium uppercase tracking-wide text-destructive">
                              Target Locked
                            </span>
                          </>
                        ) : (
                          <>
                            <Crosshair className="h-3.5 w-3.5 opacity-70" />
                            <span>{isLeader ? "Select to attack" : "Potential target"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isSelected ? (
                      <Crosshair
                        className="absolute bottom-4 right-4 z-10 h-8 w-8 text-destructive opacity-40"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Step 2: Power-up Selection */}
          <section
            className={cn(
              "relative rounded-3xl border-2 p-5 transition-all duration-500 md:p-7",
              !hasSelectedTarget
                ? "pointer-events-none border-border bg-muted/10 opacity-40 grayscale"
                : "border-primary/50 bg-card shadow-lg ring-4 ring-primary/10",
            )}
          >
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
                Step 2
              </p>
              <h3 className="mt-1 flex items-center gap-2 text-xl font-bold text-foreground">
                <Zap className="h-5 w-5 text-amber-500" aria-hidden />
                Support Your Team
              </h3>
            </div>

            {hasSelectedTarget ? (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Choose one power-up from your personal inventory to use this round.
                </p>
                <BattlePowerupRoundPanel
                  liveSession={liveSession}
                  me={me}
                  teams={teams}
                  myTeam={myTeam}
                  showChooser={!isLockedIn}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLeader
                  ? "Select a target above to reveal power-up options for your team."
                  : "Target selection required before using power-ups."}
              </p>
            )}
          </section>

          {hasSelectedTarget ? (
            <div className="mt-2 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-muted/30 px-5 py-6 text-sm font-medium shadow-sm">
              {isLockedIn ? (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    Locked in. Waiting for presenter to start the round…
                  </div>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => handleLockIn(false)}
                      disabled={lockPending}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      Unlock to change selection
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    Select power-ups above, then lock in when your team is ready.
                  </div>
                  {isLeader ? (
                    <button
                      type="button"
                      onClick={() => handleLockIn(true)}
                      disabled={lockPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 active:scale-95 transition-all sm:w-auto"
                    >
                      <Lock className="h-4 w-4" />
                      Lock In
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return null
}
