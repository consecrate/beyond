"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type SlideActionState = {
  error?: string
}

function revalidateDeckSlidePaths(deckId: string) {
  revalidatePath(`/presenter/decks/${deckId}`)
  revalidatePath(`/presenter/decks/${deckId}/edit`)
}

async function recompactSlidePositions(
  deckId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: remaining, error: fetchError } = await supabase
    .from("deck_slides")
    .select("id, position")
    .eq("deck_id", deckId)
    .order("position", { ascending: true })

  if (fetchError) return { error: fetchError.message }
  if (!remaining) return {}

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i) {
      const { error } = await supabase
        .from("deck_slides")
        .update({ position: i })
        .eq("id", remaining[i].id)
      if (error) return { error: error.message }
    }
  }
  return {}
}

export async function createSlide(deckId: string): Promise<SlideActionState> {
  const supabase = await createClient()

  // Get the next position
  const { data: existing } = await supabase
    .from("deck_slides")
    .select("position")
    .eq("deck_id", deckId)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

  const { error } = await supabase.from("deck_slides").insert({
    deck_id: deckId,
    position: nextPosition,
    title: "",
    body: "",
  })

  if (error) return { error: error.message }

  revalidateDeckSlidePaths(deckId)
  return {}
}

export async function updateSlide(
  _prev: SlideActionState,
  formData: FormData,
): Promise<SlideActionState> {
  const supabase = await createClient()

  const slideId = formData.get("slideId") as string
  const deckId = formData.get("deckId") as string
  const title = formData.get("title") as string
  const body = formData.get("body") as string
  const speakerNotes =
    (formData.get("speakerNotes") as string)?.trim() || null

  const { error } = await supabase
    .from("deck_slides")
    .update({ title, body, speaker_notes: speakerNotes })
    .eq("id", slideId)

  if (error) return { error: error.message }

  revalidateDeckSlidePaths(deckId)
  return {}
}

/** Editor / programmatic: update title, body, and speaker notes in one call. */
export async function updateSlideFields(input: {
  deckId: string
  slideId: string
  title: string
  body: string
  speakerNotes: string | null
}): Promise<SlideActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("deck_slides")
    .update({
      title: input.title,
      body: input.body,
      speaker_notes: input.speakerNotes,
    })
    .eq("id", input.slideId)

  if (error) return { error: error.message }

  revalidateDeckSlidePaths(input.deckId)
  return {}
}

export async function deleteSlide(formData: FormData): Promise<void> {
  const slideId = formData.get("slideId") as string
  const deckId = formData.get("deckId") as string

  const result = await deleteDeckSlide(deckId, slideId)
  if (result.error) throw new Error(result.error)
}

export async function deleteDeckSlide(
  deckId: string,
  slideId: string,
): Promise<SlideActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("deck_slides")
    .delete()
    .eq("id", slideId)

  if (error) return { error: error.message }

  const compact = await recompactSlidePositions(deckId)
  if (compact.error) return { error: compact.error }

  revalidateDeckSlidePaths(deckId)
  return {}
}

export async function moveSlide(formData: FormData): Promise<void> {
  const deckId = formData.get("deckId") as string
  const slideId = formData.get("slideId") as string
  const direction = formData.get("direction") as "up" | "down"

  const result = await moveDeckSlide(deckId, slideId, direction)
  if (result.error) throw new Error(result.error)
}

export async function moveDeckSlide(
  deckId: string,
  slideId: string,
  direction: "up" | "down",
): Promise<SlideActionState> {
  const supabase = await createClient()

  const { data: slides } = await supabase
    .from("deck_slides")
    .select("id, position")
    .eq("deck_id", deckId)
    .order("position", { ascending: true })

  if (!slides) return {}

  const idx = slides.findIndex((s) => s.id === slideId)
  if (idx === -1) return {}

  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= slides.length) return {}

  const current = slides[idx]
  const sibling = slides[swapIdx]

  const tempPosition = slides.length + 1000

  const { error: e1 } = await supabase
    .from("deck_slides")
    .update({ position: tempPosition })
    .eq("id", current.id)
  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from("deck_slides")
    .update({ position: current.position })
    .eq("id", sibling.id)
  if (e2) return { error: e2.message }

  const { error: e3 } = await supabase
    .from("deck_slides")
    .update({ position: sibling.position })
    .eq("id", current.id)
  if (e3) return { error: e3.message }

  revalidateDeckSlidePaths(deckId)
  return {}
}
