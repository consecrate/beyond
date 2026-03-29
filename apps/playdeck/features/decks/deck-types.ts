/** View shapes for UI (Jazz-backed decks map into these). */
export type DeckListItemView = {
  id: string
  title: string
  updated_at: string
}

export type DeckSlideView = {
  id: string
  title: string
  body: string
  updated_at: string
}
