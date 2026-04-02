import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"

import type { BattleState } from "@/features/jazz/schema"

/**
 * Merge legacy `targets` + `team_prep` rows. `team_prep` wins per team_id so
 * concurrent per-row updates don't rely on whole-map merges.
 */
export function getBattleTargetsMap(
  battleState: Loaded<typeof BattleState>,
): Record<string, string> {
  const out: Record<string, string> = {}
  const legacy = battleState.targets
  if (legacy && typeof legacy === "object") {
    for (const [k, v] of Object.entries(legacy)) {
      if (typeof v === "string" && v.length > 0) out[k] = v
    }
  }
  const list = battleState.team_prep
  if (list && list.$isLoaded) {
    assertLoaded(list)
    for (const row of list) {
      if (!row?.$isLoaded) continue
      const tid = row.target_team_id
      if (tid) out[row.team_id] = tid
    }
  }
  return out
}

export function getBattleLockedMap(
  battleState: Loaded<typeof BattleState>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  const legacy = battleState.locked_teams
  if (legacy && typeof legacy === "object") {
    for (const [k, v] of Object.entries(legacy)) {
      if (typeof v === "boolean") out[k] = v
    }
  }
  const list = battleState.team_prep
  if (list && list.$isLoaded) {
    assertLoaded(list)
    for (const row of list) {
      if (!row?.$isLoaded) continue
      if (row.locked !== undefined) out[row.team_id] = row.locked
    }
  }
  return out
}
