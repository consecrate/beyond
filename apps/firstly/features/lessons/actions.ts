"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type LessonActionState = {
  error?: string
}

function lessonPaths(sessionId: string, lessonId: string) {
  const base = `/sessions/${sessionId}/lessons/${lessonId}`
  return {
    lesson: base,
    edit: `${base}/edit`,
  }
}

function revalidateLessonScope(sessionId: string, lessonId: string) {
  const p = lessonPaths(sessionId, lessonId)
  revalidatePath(p.lesson)
  revalidatePath(p.edit)
  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
}

export async function createSession(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const title = (formData.get("title") as string)?.trim() || null

  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      title,
    })
    .select("id")
    .single()

  if (sessionError) return { error: sessionError.message }
  if (!sessionRow) return { error: "Session was not created." }

  const sessionId = sessionRow.id

  const sampleLessonTitles = ["Foundations", "Core skills", "Capstone"] as const

  const { data: lessonRows, error: lessonsError } = await supabase
    .from("lessons")
    .insert(
      sampleLessonTitles.map((t) => ({
        user_id: user.id,
        session_id: sessionId,
        title: t,
        entry_mode: "topic" as const,
        subject_domain: "math",
        future_graph_mode: "lesson_local" as const,
      })),
    )
    .select("id")

  if (lessonsError) return { error: lessonsError.message }
  if (!lessonRows || lessonRows.length !== sampleLessonTitles.length) {
    return { error: "Could not create starter lessons for this session." }
  }

  const verticalGap = 140
  const positions: Record<string, { x: number; y: number }> = {}
  lessonRows.forEach((row, i) => {
    positions[row.id] = { x: 0, y: i * verticalGap }
  })

  const graphMetadata = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    positions,
  }

  const { data: graphRow, error: graphError } = await supabase
    .from("session_graphs")
    .insert({
      session_id: sessionId,
      graph_metadata: graphMetadata,
    })
    .select("id")
    .single()

  if (graphError) return { error: graphError.message }
  if (!graphRow) return { error: "Skill graph was not created." }

  const [a, b, c] = lessonRows
  const { error: edgesError } = await supabase.from("session_graph_edges").insert([
    {
      graph_id: graphRow.id,
      from_lesson_id: a.id,
      to_lesson_id: b.id,
    },
    {
      graph_id: graphRow.id,
      from_lesson_id: b.id,
      to_lesson_id: c.id,
    },
  ])

  if (edgesError) return { error: edgesError.message }

  revalidatePath("/sessions")
  revalidatePath(`/sessions/${sessionId}`)
  return {}
}

export async function updateSession(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const sessionId = (formData.get("sessionId") as string)?.trim()
  if (!sessionId) return { error: "Missing session." }

  const title = (formData.get("title") as string)?.trim() || null
  const goalTextRaw = (formData.get("goalText") as string)?.trim()
  const goal_text = goalTextRaw ? goalTextRaw : null

  const { error: sessionError } = await supabase
    .from("sessions")
    .update({ title })
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (sessionError) return { error: sessionError.message }

  const { data: rootRow } = await supabase
    .from("lessons")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (rootRow) {
    const { error: lessonError } = await supabase
      .from("lessons")
      .update({ title, goal_text })
      .eq("id", rootRow.id)
      .eq("user_id", user.id)

    if (lessonError) return { error: lessonError.message }
  }

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
  return {}
}

export async function updateLesson(
  _prev: LessonActionState,
  formData: FormData,
): Promise<LessonActionState> {
  const supabase = await createClient()

  const lessonId = formData.get("lessonId") as string
  const sessionId = (formData.get("sessionId") as string)?.trim()
  const title = (formData.get("title") as string)?.trim() || null
  const goalTextRaw = (formData.get("goalText") as string)?.trim()
  const goal_text = goalTextRaw ? goalTextRaw : null

  const { error } = await supabase
    .from("lessons")
    .update({ title, goal_text })
    .eq("id", lessonId)

  if (error) return { error: error.message }

  if (sessionId) {
    revalidateLessonScope(sessionId, lessonId)
  } else {
    const { data: row } = await supabase
      .from("lessons")
      .select("session_id")
      .eq("id", lessonId)
      .maybeSingle()
    if (row?.session_id) {
      revalidateLessonScope(row.session_id, lessonId)
    }
  }

  return {}
}

export async function deleteLesson(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const lessonId = formData.get("lessonId") as string
  const sessionIdFromForm = (formData.get("sessionId") as string)?.trim()

  let sessionId: string | undefined = sessionIdFromForm || undefined
  if (!sessionId) {
    const { data: row } = await supabase
      .from("lessons")
      .select("session_id")
      .eq("id", lessonId)
      .maybeSingle()
    sessionId = row?.session_id ?? undefined
  }

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId)

  if (error) throw error

  revalidatePath("/sessions")
  if (sessionId) {
    revalidatePath(`/sessions/${sessionId}`)
  }

  if (sessionId) {
    redirect(`/sessions/${sessionId}`)
  }
  redirect("/sessions")
}

export async function deleteSession(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  const sessionId = (formData.get("sessionId") as string)?.trim()
  if (!sessionId) throw new Error("Missing session.")

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) throw error

  revalidatePath("/sessions")
  redirect("/sessions")
}
