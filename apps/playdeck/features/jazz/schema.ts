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
