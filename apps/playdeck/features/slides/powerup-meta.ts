import type { PowerupType } from "@/features/jazz/schema"
import type { z } from "jazz-tools"
import type { LucideIcon } from "lucide-react"
import {
  FlaskConical,
  HeartPulse,
  RotateCcw,
  Scissors,
  Shield,
  Swords,
  TrendingUp,
  Zap,
} from "lucide-react"

export type PowerupCatalogEntry = {
  type: z.infer<typeof PowerupType>
  name: string
  desc: string
  cost: number
  /** Lucide icon component shown on cards. */
  Icon: LucideIcon
  /** Tailwind color token prefix (e.g. "sky") used for card accent. */
  colorToken: "amber" | "sky" | "emerald" | "rose" | "violet" | "orange" | "red" | "pink"
}

/** Single source of truth for shop catalog (names, descriptions, costs, icons, colors). */
export const POWERUP_CATALOG: readonly PowerupCatalogEntry[] = [
  {
    type: "1/4",
    name: "1/4 Powerup",
    desc: "Eliminate 1 incorrect option.",
    cost: 20,
    Icon: Scissors,
    colorToken: "amber",
  },
  {
    type: "healing_potion",
    name: "Healing Potion",
    desc: "Gift 1 HP to another team.",
    cost: 20,
    Icon: FlaskConical,
    colorToken: "emerald",
  },
  {
    type: "shield",
    name: "Shield",
    desc: "Block the next 1 HP of damage.",
    cost: 30,
    Icon: Shield,
    colorToken: "sky",
  },
  {
    type: "medkit",
    name: "Medkit",
    desc: "Restore 2 HP instantly.",
    cost: 40,
    Icon: HeartPulse,
    colorToken: "rose",
  },
  {
    type: "double_damage",
    name: "Double Damage",
    desc: "Deal 2 HP instead of 1.",
    cost: 40,
    Icon: Zap,
    colorToken: "orange",
  },
  {
    type: "step_up",
    name: "Step Up",
    desc: "Increase your team's HP by 1.",
    cost: 30,
    Icon: TrendingUp,
    colorToken: "violet",
  },
  {
    type: "deflect",
    name: "Deflect",
    desc: "Bounce damage back to attacker.",
    cost: 50,
    Icon: RotateCcw,
    colorToken: "pink",
  },
  {
    type: "critical_hit",
    name: "Critical Hit",
    desc: "Deals 3 HP at 100% team accuracy.",
    cost: 60,
    Icon: Swords,
    colorToken: "red",
  },
] as const

/** HP-related types multiple teammates may each pick once per round; others are one per team. */
export const STACKABLE_POWERUP_TYPES = new Set<z.infer<typeof PowerupType>>([
  "healing_potion",
  "step_up",
])

export function isPowerupTypeStackable(
  t: z.infer<typeof PowerupType>,
): boolean {
  return STACKABLE_POWERUP_TYPES.has(t)
}

export function formatPowerupLabel(type: string): string {
  return type.replace("_", " ")
}
