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

export const Team = co.map({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  leader_account_id: z.string().optional(),
  hp: z.number().optional(),
})

export const SessionPlayer = co.map({
  account_id: z.string(),
  name: z.string(),
  play_points: z.number().optional(),
  team_id: z.string().optional(),
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
