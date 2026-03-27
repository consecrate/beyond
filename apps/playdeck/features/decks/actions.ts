"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type DeckActionState = {
  error?: string
}

export async function createDeck(
  _prev: DeckActionState,
  formData: FormData,
): Promise<DeckActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/presenter/sign-in")

  const title = (formData.get("title") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null

  if (!title) return { error: "Title is required." }

  const { error } = await supabase
    .from("decks")
    .insert({ presenter_id: user.id, title, description })

  if (error) return { error: error.message }

  revalidatePath("/presenter/decks")
  return {}
}

export async function updateDeck(
  _prev: DeckActionState,
  formData: FormData,
): Promise<DeckActionState> {
  const supabase = await createClient()

  const deckId = formData.get("deckId") as string
  const title = (formData.get("title") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null

  if (!title) return { error: "Title is required." }

  const { error } = await supabase
    .from("decks")
    .update({ title, description })
    .eq("id", deckId)

  if (error) return { error: error.message }

  revalidatePath(`/presenter/decks/${deckId}`)
  revalidatePath(`/presenter/decks/${deckId}/edit`)
  return {}
}

export async function deleteDeck(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const deckId = formData.get("deckId") as string

  const { error } = await supabase.from("decks").delete().eq("id", deckId)

  if (error) throw error

  revalidatePath("/presenter/decks")
  redirect("/presenter/decks")
}
