"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type LessonActionState = {
  error?: string
}

export async function createLesson(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const title = (formData.get("title") as string)?.trim() || null
  const goalTextRaw = (formData.get("goalText") as string)?.trim()
  const goal_text = goalTextRaw ? goalTextRaw : null
  const entry_mode =
    (formData.get("entryMode") as string) || "topic"

  if (entry_mode !== "topic" && entry_mode !== "problem_set" && entry_mode !== "mixed") {
    return { error: "Invalid entry mode." }
  }

  const { error } = await supabase.from("lessons").insert({
    user_id: user.id,
    title,
    goal_text,
    entry_mode,
  })

  if (error) return { error: error.message }

  revalidatePath("/lessons")
  return {}
}

export async function updateLesson(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const supabase = await createClient()

  const lessonId = formData.get("lessonId") as string
  const title = (formData.get("title") as string)?.trim() || null
  const goalTextRaw = (formData.get("goalText") as string)?.trim()
  const goal_text = goalTextRaw ? goalTextRaw : null

  const { error } = await supabase
    .from("lessons")
    .update({ title, goal_text })
    .eq("id", lessonId)

  if (error) return { error: error.message }

  revalidatePath(`/lessons/${lessonId}`)
  revalidatePath(`/lessons/${lessonId}/edit`)
  revalidatePath("/lessons")
  return {}
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const lessonId = formData.get("lessonId") as string

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId)

  if (error) throw error

  revalidatePath("/lessons")
  redirect("/lessons")
}
