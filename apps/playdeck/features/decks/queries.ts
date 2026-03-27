import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type DeckRow = Database["public"]["Tables"]["decks"]["Row"]
export type SlideRow = Database["public"]["Tables"]["deck_slides"]["Row"]

export async function getPresenterDecks(options?: {
  limit?: number
}): Promise<DeckRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  let q = supabase
    .from("decks")
    .select("*")
    .eq("presenter_id", user.id)
    .order("updated_at", { ascending: false })

  if (options?.limit != null) q = q.limit(options.limit)

  const { data, error } = await q

  if (error) throw error
  return data
}

/** First slide title per deck (position order); one query per id, parallelized. */
export async function getFirstSlideTitlesByDeckIds(
  deckIds: string[],
): Promise<Map<string, string>> {
  if (deckIds.length === 0) return new Map()
  const supabase = await createClient()
  const rows = await Promise.all(
    deckIds.map(async (deckId) => {
      const { data } = await supabase
        .from("deck_slides")
        .select("title")
        .eq("deck_id", deckId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle()
      const title = data?.title?.trim()
      return title ? ([deckId, title] as const) : null
    }),
  )
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row) map.set(row[0], row[1])
  }
  return map
}

export async function getDeckWithSlides(
  deckId: string,
): Promise<{ deck: DeckRow; slides: SlideRow[] }> {
  const supabase = await createClient()

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .single()

  if (deckError) throw deckError

  const { data: slides, error: slidesError } = await supabase
    .from("deck_slides")
    .select("*")
    .eq("deck_id", deckId)
    .order("position", { ascending: true })

  if (slidesError) throw slidesError

  return { deck, slides }
}
