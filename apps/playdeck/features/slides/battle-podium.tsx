"use client"

import { useMemo } from "react"
import type { Loaded } from "jazz-tools"

import type { LiveSession, Team } from "@/features/jazz/schema"
import { Button, cn } from "@beyond/design-system"
import { Loader2, Trophy } from "lucide-react"

export type PodiumRow = {
  rank: 1 | 2 | 3
  team: Loaded<typeof Team>
}

/** Sort by HP descending; stable tie-breaker by team id. */
export function computePodiumTopTeams(
  teams: Loaded<typeof Team>[],
  max = 3,
): PodiumRow[] {
  const sorted = [...teams].sort((a, b) => {
    const hpA = a.hp ?? 0
    const hpB = b.hp ?? 0
    if (hpB !== hpA) return hpB - hpA
    return a.id.localeCompare(b.id)
  })
  const out: PodiumRow[] = []
  for (let i = 0; i < Math.min(max, sorted.length); i++) {
    const t = sorted[i]
    if (!t) continue
    out.push({ rank: (i + 1) as 1 | 2 | 3, team: t })
  }
  return out
}

export type BattlePodiumProps = {
  liveSession: Loaded<typeof LiveSession>
  variant: "presenter" | "audience"
  onContinue?: () => void
}

const rankStyles: Record<
  1 | 2 | 3,
  { bar: string; medal: string; label: string }
> = {
  1: {
    bar: "from-amber-400 to-amber-600",
    medal: "text-amber-400",
    label: "1st",
  },
  2: {
    bar: "from-slate-300 to-slate-500",
    medal: "text-slate-300",
    label: "2nd",
  },
  3: {
    bar: "from-amber-700 to-amber-900",
    medal: "text-amber-700",
    label: "3rd",
  },
}

export function BattlePodium({ liveSession, variant, onContinue }: BattlePodiumProps) {
  const teamsList = liveSession.teams

  const podium = useMemo(() => {
    if (!teamsList || !teamsList.$isLoaded) return []
    const all = [...teamsList].filter((t): t is Loaded<typeof Team> => !!t && t.$isLoaded)
    return computePodiumTopTeams(all, 3)
  }, [teamsList])

  if (!teamsList || !teamsList.$isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
        <p className="text-sm">Loading podium…</p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-amber-500/20 px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <Trophy className="h-9 w-9 text-amber-500" />
          <h1 className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-3xl font-black uppercase tracking-[0.18em] text-transparent md:text-4xl">
            Podium
          </h1>
        </div>
        <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-500">
          Top 3
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 items-end justify-center gap-4 px-4 pb-8 pt-4 md:gap-8 md:px-10">
        {podium.length === 0 ? (
          <p className="self-center text-center text-sm text-muted-foreground">
            No teams yet.
          </p>
        ) : (
          podium.map(({ rank, team }) => {
            const style = rankStyles[rank]
            const heightClass =
              rank === 1 ? "h-[min(52vh,420px)]" : rank === 2 ? "h-[min(42vh,340px)]" : "h-[min(36vh,300px)]"
            return (
              <div
                key={team.id}
                className="flex w-[min(100%,200px)] flex-col items-center md:w-[240px]"
              >
                <div
                  className={cn(
                    "mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-black/40 bg-gradient-to-br text-2xl font-black shadow-lg md:h-16 md:w-16 md:text-3xl",
                    style.bar,
                )}
                  aria-hidden
                >
                  <span className={style.medal}>{rank}</span>
                </div>
                <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-amber-500/90">
                  {style.label}
                </p>
                <div
                  className={cn(
                    "flex w-full flex-col justify-end rounded-t-xl border-2 border-black/30 bg-gradient-to-t p-4 text-center shadow-xl",
                    style.bar,
                    heightClass,
                  )}
                >
                  <p className="text-balance font-black text-foreground drop-shadow-md md:text-lg">
                    {team.name}
                  </p>
                  <p className="mt-2 text-sm font-bold tabular-nums text-foreground/90">
                    ❤️ {team.hp ?? 0} HP
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {variant === "presenter" && onContinue ? (
        <footer className="relative z-10 flex shrink-0 justify-center border-t border-amber-500/20 px-6 py-5">
          <Button
            type="button"
            size="lg"
            className="rounded-none px-10 text-base font-black uppercase tracking-widest"
            onClick={() => onContinue()}
          >
            Continue
          </Button>
        </footer>
      ) : variant === "audience" ? (
        <footer className="relative z-10 flex shrink-0 justify-center border-t border-amber-500/20 px-6 py-4">
          <p className="text-center text-sm text-muted-foreground">
            Waiting for the host to continue…
          </p>
        </footer>
      ) : null}
    </div>
  )
}
