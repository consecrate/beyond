import { useState, useTransition } from "react"
import type { Loaded } from "jazz-tools"

import type {
  LiveSession,
  PlaydeckAccount,
  SessionPlayer,
  Team,
} from "@/features/jazz/schema"
import { selectBattleTarget } from "@/features/jazz/live-session-mutations"
import { BattlePowerupRoundPanel } from "@/features/slides/battle-powerup-round-panel"
import { cn } from "@beyond/design-system"
import { Crosshair, Loader2, Shield } from "lucide-react"

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
  let targets = battleState.targets ?? {}
  if (typeof targets !== "object" || targets === null) targets = {}

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

  const hasSelectedTarget = !!targets[myTeam.id]

  if (phase === "target_selection") {
    if (isLeader) {
      return (
        <div className="relative flex h-full min-h-0 flex-col bg-background px-4 py-6 text-foreground md:px-6">
          <div className="mb-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Battle Royale
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Select target
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose which team to attack this round.
            </p>
          </div>

          {targetError ? (
            <div
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
              role="alert"
            >
              {targetError}
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 sm:gap-0">
            {teams.map((t) => {
              if (t.id === myTeam.id) return null
              const tDown = t.hp === undefined || t.hp <= 0
              const isSelected = targets[myTeam.id] === t.id

              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={tDown || targetPending || hasSelectedTarget}
                  onClick={() => handleSelectTarget(t.id)}
                  className={cn(
                    "relative flex min-h-22 flex-col items-start gap-1 overflow-hidden rounded-none border p-4 text-left transition-[filter,transform] sm:min-h-0",
                    "border-foreground/25 bg-card text-foreground",
                    tDown &&
                      "cursor-not-allowed opacity-40 grayscale",
                    !tDown &&
                      !hasSelectedTarget &&
                      "cursor-pointer hover:brightness-[1.02] active:scale-[0.99]",
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
                            Selected
                          </span>
                        </>
                      ) : (
                        <>
                          <Crosshair className="h-3.5 w-3.5 opacity-70" />
                          <span>Tap to attack</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isSelected ? (
                    <Crosshair
                      className="absolute bottom-3 right-3 z-10 h-7 w-7 text-destructive"
                      aria-hidden
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          {hasSelectedTarget ? (
            <>
              <BattlePowerupRoundPanel
                liveSession={liveSession}
                me={me}
                teams={teams}
                myTeam={myTeam}
              />
              <div className="mt-4 flex items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Waiting for presenter…
              </div>
            </>
          ) : null}
        </div>
      )
    }

    if (hasSelectedTarget) {
      return (
        <div className="relative flex h-full min-h-0 flex-col overflow-auto bg-background px-4 py-6 text-foreground md:px-6">
          <div className="mb-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Battle Royale
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Round power-up
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Target locked — tap a power-up you own in the grid below.
            </p>
          </div>
          <BattlePowerupRoundPanel
            liveSession={liveSession}
            me={me}
            teams={teams}
            myTeam={myTeam}
          />
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
        <Crosshair
          className="mb-5 h-14 w-14 text-muted-foreground"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Battle Royale
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Locking targets
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          Your team leader is selecting your target for this round.
        </p>
      </div>
    )
  }

  return null
}
