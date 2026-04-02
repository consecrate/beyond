"use client"

import { useMemo } from "react"
import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"

import type { LiveSession, Team } from "@/features/jazz/schema"
import { Button, cn } from "@beyond/design-system"
import { Loader2, Swords } from "lucide-react"

export type BattleLogProps = {
  liveSession: Loaded<typeof LiveSession>
  variant: "presenter" | "audience"
  onNextQuestion?: () => void
}

export function BattleLog({ liveSession, variant, onNextQuestion }: BattleLogProps) {
  const battleState = liveSession.battle_state
  const teamsList = liveSession.teams

  const teams = useMemo(() => {
    if (!teamsList || !teamsList.$isLoaded) return []
    return [...teamsList].filter((t): t is Loaded<typeof Team> => !!t && t.$isLoaded)
  }, [teamsList])

  const leftTeams = teams.filter((_, i) => i % 2 === 0)
  const rightTeams = teams.filter((_, i) => i % 2 === 1)

  if (!battleState || !battleState.$isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-red-500" />
        <p className="text-sm">Loading battle log…</p>
      </div>
    )
  }

  const summary = battleState.round_summary
  const entries: Array<{
    attacker_team_id: string
    target_team_id: string
    attacker_name: string
    target_name: string
    was_correct: boolean
    attacker_correct_percentage?: number
    damage: number
    target_hp_before: number
    target_hp_after: number
    target_downed: boolean
  }> = []

  if (summary && summary.$isLoaded) {
    assertLoaded(summary)
    const list = summary.entries
    if (list && list.$isLoaded) {
      assertLoaded(list)
      for (const e of list) {
        if (!e || !e.$isLoaded) continue
        entries.push({
          attacker_team_id: e.attacker_team_id,
          target_team_id: e.target_team_id,
          attacker_name: e.attacker_name,
          target_name: e.target_name,
          was_correct: e.was_correct,
          attacker_correct_percentage: e.attacker_correct_percentage,
          damage: e.damage,
          target_hp_before: e.target_hp_before,
          target_hp_after: e.target_hp_after,
          target_downed: e.target_downed,
        })
      }
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(#f00 1px, transparent 1px), linear-gradient(90deg, #f00 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-red-500/20 px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <Swords className="h-9 w-9 text-red-500" />
          <h1 className="bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-3xl font-black uppercase tracking-[0.18em] text-transparent md:text-4xl">
            Battle Log
          </h1>
        </div>
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-500">
          Round recap
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-4 px-4 pb-6 pt-4 md:gap-6 md:px-8">
        <div className="flex w-[min(100%,280px)] shrink-0 flex-col justify-center gap-4 overflow-y-auto md:w-[320px]">
          {leftTeams.map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-xl border-2 p-4 text-left shadow-lg backdrop-blur",
                t.color,
              )}
            >
              <p className="text-lg font-black">{t.name}</p>
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                ❤️ {t.hp ?? 0}
              </p>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-red-500/25 bg-black/40 p-4 shadow-inner backdrop-blur-sm md:p-6">
          {entries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No combat events this round.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map((row, i) => {
                const attackerColor = teams.find(t => t.id === row.attacker_team_id)?.color?.split(' ').find(c => c.startsWith('text-')) || "text-amber-500"
                const targetColor = teams.find(t => t.id === row.target_team_id)?.color?.split(' ').find(c => c.startsWith('text-')) || "text-sky-400"

                const outcome = !row.target_team_id
                  ? "No target selected"
                  : !row.was_correct
                    ? `Missed (${row.attacker_correct_percentage ?? 0}% correct)`
                    : row.damage > 0
                      ? `Hit ${row.target_name} for ${row.damage} HP`
                      : "No damage"
                const hpLine =
                  row.target_team_id && row.was_correct && row.damage > 0
                    ? `HP ${row.target_hp_before} → ${row.target_hp_after}${
                        row.target_downed ? " (downed)" : ""
                      }`
                    : null
                return (
                  <li
                    key={`${row.attacker_team_id}-${row.target_team_id}-${i}`}
                    className="rounded-lg border border-white/10 bg-white/5 shadow-md backdrop-blur-md px-4 py-3 text-left"
                  >
                    <p className="text-sm font-bold text-foreground">
                      <span className={attackerColor}>{row.attacker_name}</span>
                      <span className="mx-2 font-normal text-white">→</span>
                      <span className={targetColor}>{row.target_name}</span>
                    </p>
                    <p className="mt-1 text-sm text-white">{outcome}</p>
                    {hpLine ? (
                      <p className="mt-1 text-xs tabular-nums text-white">
                        {hpLine}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex w-[min(100%,280px)] shrink-0 flex-col justify-center gap-4 overflow-y-auto md:w-[320px]">
          {rightTeams.map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-xl border-2 p-4 text-right shadow-lg backdrop-blur",
                t.color,
              )}
            >
              <p className="text-lg font-black">{t.name}</p>
              <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                ❤️ {t.hp ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      {variant === "presenter" && onNextQuestion ? (
        <footer className="relative z-10 flex shrink-0 justify-center border-t border-red-500/20 px-6 py-5">
          <Button
            type="button"
            size="lg"
            className="rounded-none px-10 text-base font-black uppercase tracking-widest"
            onClick={() => onNextQuestion()}
          >
            Next question
          </Button>
        </footer>
      ) : variant === "audience" ? (
        <footer className="relative z-10 flex shrink-0 justify-center border-t border-red-500/20 px-6 py-4">
          <p className="text-center text-sm text-muted-foreground">
            Waiting for the host to continue…
          </p>
        </footer>
      ) : null}
    </div>
  )
}
