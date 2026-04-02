import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Loaded } from "jazz-tools"

import {
  getBattleLockedMap,
  getBattleTargetsMap,
} from "@/features/jazz/battle-state-targets"
import type { BattleState, LiveSession, Team } from "@/features/jazz/schema"
import { formatPowerupLabel } from "@/features/slides/powerup-meta"
import { Button, cn } from "@beyond/design-system"
import { Heart, Swords, Target, Loader2, Lock } from "lucide-react"

export type BattleRoyaleArenaProps = {
  liveSession: Loaded<typeof LiveSession>
  onStartQuestion: () => void
}

function powerupLineForTeam(
  battleState: Loaded<typeof BattleState>,
  teamId: string,
  allTeams: Loaded<typeof Team>[],
): string | null {
  const list = battleState.powerup_selections
  if (!list?.$isLoaded) return null
  const parts: string[] = []
  for (const s of list) {
    if (!s?.$isLoaded) continue
    if (s.team_id !== teamId) continue
    const label = formatPowerupLabel(s.powerup_type)
    const mark = s.status === "confirmed" ? "✓" : "…"
    if (s.powerup_type === "healing_potion" && s.healing_target_team_id) {
      const ht = allTeams.find((x) => x.id === s.healing_target_team_id)
      parts.push(`${mark} ${label}${ht ? ` → ${ht.name}` : ""}`)
    } else {
      parts.push(`${mark} ${label}`)
    }
  }
  return parts.length ? parts.join(" · ") : null
}

function TeamTotem({
  team,
  isRight,
  target,
  powerupLine,
  isLocked,
}: {
  team: Loaded<typeof Team>
  isRight: boolean
  target: Loaded<typeof Team> | null
  powerupLine: string | null
  isLocked: boolean
}) {
  const isDown = team.hp === undefined || team.hp <= 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: isDown ? "grayscale(1) brightness(0.92)" : "none",
      }}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border-2 p-5 shadow-sm transition-all duration-300",
        "bg-card text-foreground",
        team.color,
        "bg-card text-foreground",
        isRight ? "items-start text-left" : "items-end text-right",
      )}
    >
      {target && !isDown && (
        <div
          className={cn(
            "absolute -top-2.5 whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground shadow-sm",
            isRight ? "left-3" : "right-3",
          )}
        >
          Targets: {target.name}
        </div>
      )}

      {isLocked && !isDown && (
        <div
          className={cn(
            "absolute -top-2.5 flex items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm",
            isRight ? "right-3" : "left-3",
          )}
        >
          <Lock className="h-3 w-3" />
          Locked In
        </div>
      )}

      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {team.name}
      </h2>

      {powerupLine ? (
        <p
          className={cn(
            "max-w-full text-xs font-medium text-muted-foreground",
            isRight ? "text-left" : "text-right",
          )}
        >
          {powerupLine}
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap gap-1.5",
          isRight ? "justify-start" : "justify-end",
        )}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              scale: i < (team.hp ?? 0) ? [1, 1.08, 1] : 0.85,
              opacity: i < (team.hp ?? 0) ? 1 : 0.25,
            }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
          >
            <Heart
              className={cn(
                "h-5 w-5 sm:h-6 sm:w-6",
                i < (team.hp ?? 0)
                  ? "fill-destructive text-destructive"
                  : "text-muted-foreground",
              )}
            />
          </motion.div>
        ))}
      </div>

      {isDown && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/85 backdrop-blur-sm">
          <span className="rounded-md border-2 border-destructive px-3 py-1.5 text-lg font-bold uppercase tracking-wide text-destructive sm:text-xl">
            Eliminated
          </span>
        </div>
      )}
    </motion.div>
  )
}

/** Presenter-only: target selection before the shared MCQ overlay takes over. */
export function BattleRoyaleArena({
  liveSession,
  onStartQuestion,
}: BattleRoyaleArenaProps) {
  const teamsList = liveSession.teams
  const teams = useMemo(() => {
    if (!teamsList || !teamsList.$isLoaded) return []
    return [...teamsList].filter((t): t is Loaded<typeof Team> => !!t && t.$isLoaded)
  }, [teamsList])

  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return (
      <div className="absolute inset-0 z-50 flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading battle state…</p>
      </div>
    )
  }

  const targets = getBattleTargetsMap(battleState)
  const lockedTeams = getBattleLockedMap(battleState)

  const leftTeams = teams.filter((_, i) => i % 2 === 0)
  const rightTeams = teams.filter((_, i) => i % 2 === 1)

  const totemPowerup = (t: Loaded<typeof Team>) =>
    powerupLineForTeam(battleState, t.id, teams)

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Swords className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Mode
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Battle Royale
            </h1>
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Locking targets
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-4 overflow-hidden px-4 pb-6 pt-4 md:px-8 md:pb-8">
        <div className="relative z-10 hidden w-[min(100%,280px)] shrink-0 flex-col justify-center gap-4 overflow-y-auto md:flex md:w-[320px] lg:w-[350px]">
          {leftTeams.map((t) => {
            const targetId = targets[t.id]
            const targetTeam = targetId
              ? teams.find((x) => x.id === targetId)
              : null
            return (
              <TeamTotem
                key={t.id}
                team={t}
                isRight={false}
                target={targetTeam ?? null}
                powerupLine={totemPowerup(t)}
                isLocked={!!lockedTeams[t.id]}
              />
            )
          })}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key="target_selection"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex max-w-xl flex-col items-center gap-5 text-center md:gap-6"
            >
              <Target
                className="h-14 w-14 text-muted-foreground md:h-16 md:w-16"
                aria-hidden
              />
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Select your targets
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                Team leaders, assign your attack targets on your devices now.
              </p>

              <Button
                type="button"
                onClick={() => onStartQuestion()}
                size="lg"
                className="mt-2 rounded-none px-8 text-base font-semibold uppercase tracking-wide"
              >
                Initiate attack
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative z-10 hidden w-[min(100%,280px)] shrink-0 flex-col justify-center gap-4 overflow-y-auto md:flex md:w-[320px] lg:w-[350px]">
          {rightTeams.map((t) => {
            const targetId = targets[t.id]
            const targetTeam = targetId
              ? teams.find((x) => x.id === targetId)
              : null
            return (
              <TeamTotem
                key={t.id}
                team={t}
                isRight={true}
                target={targetTeam ?? null}
                powerupLine={totemPowerup(t)}
                isLocked={!!lockedTeams[t.id]}
              />
            )
          })}
        </div>
      </div>

      {/* Narrow viewports: stack team columns below prompt */}
      <div className="flex max-h-[40vh] min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-t border-border px-4 py-4 md:hidden">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((t) => {
            const targetId = targets[t.id]
            const targetTeam = targetId
              ? teams.find((x) => x.id === targetId)
              : null
            const isRight = teams.indexOf(t) % 2 === 1
            return (
              <TeamTotem
                key={t.id}
                team={t}
                isRight={isRight}
                target={targetTeam ?? null}
                powerupLine={totemPowerup(t)}
                isLocked={!!lockedTeams[t.id]}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
