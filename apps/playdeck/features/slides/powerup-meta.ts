import type { PowerupType } from "@/features/jazz/schema"
import type { z } from "jazz-tools"

export type PowerupCatalogEntry = {
  type: z.infer<typeof PowerupType>
  name: string
  desc: string
  cost: number
}

/** Single source of truth for shop catalog (names, descriptions, costs). */
export const POWERUP_CATALOG: readonly PowerupCatalogEntry[] = [
  { type: "1/4", name: "1/4", desc: "Eliminate 1 incorrect option.", cost: 20 },
  {
    type: "healing_potion",
    name: "Healing Potion",
    desc: "Gift 1 HP to another team.",
    cost: 20,
  },
  { type: "shield", name: "Shield", desc: "Block the next 1 HP of damage.", cost: 30 },
  { type: "medkit", name: "Medkit", desc: "Restore 2 HP instantly.", cost: 40 },
  {
    type: "double_damage",
    name: "Double Damage",
    desc: "Deal 2 HP instead of 1.",
    cost: 40,
  },
  { type: "deflect", name: "Deflect", desc: "Bounce damage back to attacker.", cost: 50 },
  {
    type: "critical_hit",
    name: "Critical Hit",
    desc: "Deals 3 HP if 100% accuracy.",
    cost: 60,
  },
] as const

export function formatPowerupLabel(type: string): string {
  return type.replace("_", " ")
}
