import type { Loaded } from "jazz-tools"

import type { LiveSession } from "@/features/jazz/schema"

/** If current user has confirmed 1/4 for their team, return first incorrect option canonical index to hide. */
export function getQuarterStrikeHiddenCanonicalIndex(
  liveSession: Loaded<typeof LiveSession>,
  userId: string,
  myTeamId: string | undefined,
  options: readonly { isCorrect: boolean }[],
): number | null {
  if (!myTeamId) return null
  const bs = liveSession.battle_state
  if (!bs?.$isLoaded) return null
  const list = bs.powerup_selections
  if (!list?.$isLoaded) return null
  for (const s of list) {
    if (!s?.$isLoaded) continue
    if (s.team_id !== myTeamId || s.status !== "confirmed") continue
    if (s.powerup_type !== "1/4") continue
    if (s.picker_account_id !== userId) continue
    const idx = options.findIndex((o) => !o.isCorrect)
    return idx >= 0 ? idx : null
  }
  return null
}
