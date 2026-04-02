import { co, Group, z } from "jazz-tools"

export const DeckSlide = co.map({
  title: z.string(),
  body: z.string(),
  slideKind: z.literal("simple"),
})

export const Deck = co.map({
  title: z.string(),
  updatedAt: z.string(),
  slides: co.list(DeckSlide),
})

export const PollVote = co.map({
  user_id: z.string(),
  poll_key: z.string(),
  option_index: z.number(),
})

export const QuestionSubmission = co.map({
  user_id: z.string(),
  question_key: z.string(),
  option_index: z.number(),
})

export const QuestionState = co.map({
  question_key: z.string(),
  status: z.union([z.literal("idle"), z.literal("open"), z.literal("revealed")]),
})

export const PowerupType = z.union([
  z.literal("1/4"),
  z.literal("double_damage"),
  z.literal("shield"),
  z.literal("deflect"),
  z.literal("medkit"),
  z.literal("critical_hit"),
  z.literal("healing_potion"),
  z.literal("step_up"),
])

/** One member's round-scoped power-up activation (confirmed when chosen; no leader approval). */
export const BattlePowerupSelection = co.map({
  team_id: z.string(),
  powerup_type: PowerupType,
  picker_account_id: z.string(),
  status: z.union([z.literal("pending"), z.literal("confirmed")]),
  /** Required when powerup_type is healing_potion: gift recipient team. */
  healing_target_team_id: z.string().optional(),
})

export const Powerup = co.map({
  type: PowerupType,
  owner_account_id: z.string(),
  is_used: z.boolean(),
})

export const Team = co.map({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  leader_account_id: z.string().optional(),
  hp: z.number().optional(),
  status: z.union([z.literal("active"), z.literal("downed")]).optional(),
  banked_play_points: z.number().optional(), // Sum of member play points at store entry (display / legacy)
  powerups: co.list(Powerup).optional(),
})

export const SessionPlayer = co.map({
  account_id: z.string(),
  name: z.string(),
  play_points: z.number().optional(),
  team_id: z.string().optional(),
})

/** One row in the post-reveal battle log for the current round (ephemeral until next reset). */
export const BattleRoundEntry = co.map({
  attacker_team_id: z.string(),
  target_team_id: z.string(),
  attacker_name: z.string(),
  target_name: z.string(),
  was_correct: z.boolean(),
  attacker_correct_percentage: z.number().optional(),
  damage: z.number(),
  target_hp_before: z.number(),
  target_hp_after: z.number(),
  target_downed: z.boolean(),
})

export const BattleRoundSummary = co.map({
  question_key: z.string(),
  entries: co.list(BattleRoundEntry),
})

/**
 * Per-attacking-team prep for a round: target + lock-in, updated one team at a time
 * (avoids whole-map overwrites when two leaders act concurrently).
 */
export const BattleTeamPrep = co.map({
  team_id: z.string(),
  target_team_id: z.string().optional(),
  locked: z.boolean().optional(),
})

export const BattleState = co.map({
  question_key: z.string().optional(),
  phase: z
    .union([
      z.literal("target_selection"),
      z.literal("question_active"),
      z.literal("results"),
      z.literal("battle_log"),
      z.literal("podium"),
    ])
    .optional(),
  /** @deprecated Prefer `team_prep`; kept for legacy sessions. */
  targets: z.record(z.string(), z.string()).optional(),
  round_summary: BattleRoundSummary.optional(),
  /** Per-round power-up claims (pending/confirmed); inventory is consumed on round resolve. */
  powerup_selections: co.list(BattlePowerupSelection).optional(),
  /** @deprecated Prefer `team_prep`; kept for legacy sessions. */
  locked_teams: z.record(z.string(), z.boolean()).optional(),
  /** One row per attacking team; mutate a single row when a leader picks target or locks. */
  team_prep: co.list(BattleTeamPrep).optional(),
})

/** Public-read live deck snapshot + authoritative slide index for viewers. */
export const LiveSession = co.map({
  deckTitle: z.string(),
  markdown: z.string(),
  activeSlideIndex: z.number(),
  status: z.union([z.literal("live"), z.literal("ended")]),
  is_lobby_visible: z.boolean().optional(),
  presenter_account_id: z.string(),
  joined_players: co.list(SessionPlayer).optional(),
  poll_votes: co.list(PollVote),
  /** Poll keys that no longer accept votes (final results). */
  closed_poll_keys: co.list(z.string()).optional(),
  question_submissions: co.list(QuestionSubmission).optional(),
  question_states: co.list(QuestionState).optional(),
  teams: co.list(Team).optional(),
  team_formation_state: z.union([z.literal("idle"), z.literal("setup"), z.literal("open")]).optional(),
  game_phase: z.union([z.literal("lobby"), z.literal("store"), z.literal("playing"), z.literal("battle_royale")]).optional(),
  battle_state: BattleState.optional(),
})

export const PlaydeckRoot = co.map({
  decks: co.list(Deck),
})

const PlaydeckProfile = co.profile({
  name: z.string(),
})

export const PlaydeckAccount = co
  .account({
    profile: PlaydeckProfile,
    root: PlaydeckRoot,
  })
  .withMigration((account, creationProps) => {
    if (!account.$jazz.has("root")) {
      account.$jazz.set(
        "root",
        PlaydeckRoot.create(
          {
            decks: co.list(Deck).create([], account),
          },
          account,
        ),
      )
    }

    if (!account.$jazz.has("profile")) {
      const profileGroup = Group.create()
      profileGroup.addMember("everyone", "reader")
      account.$jazz.set(
        "profile",
        PlaydeckProfile.create(
          { name: creationProps?.name?.trim() || "Presenter" },
          profileGroup,
        ),
      )
    }
  })
