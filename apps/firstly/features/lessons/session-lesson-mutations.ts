import "server-only"

import { revalidatePath } from "next/cache"

import { integrateNewLessonIntoSessionGraph } from "@/features/sessions/graph-mutations"
import { createClient } from "@/lib/supabase/server"

function revalidateSessionLessonScope(sessionId: string, lessonId: string) {
  const base = `/sessions/${sessionId}/lessons/${lessonId}`
  revalidatePath(base)
  revalidatePath(`${base}/edit`)
  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
}

/** Ensures one session_graph row exists so prerequisite edges can be stored. */
export async function ensureSessionGraphForUser(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (sessionErr) return { ok: false, error: sessionErr.message }
  if (!sessionRow) return { ok: false, error: "Session not found." }

  const { data: existing, error: gErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (gErr) return { ok: false, error: gErr.message }
  if (existing) return { ok: true }

  const { error: insErr } = await supabase.from("session_graphs").insert({
    session_id: sessionId,
    graph_metadata: {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      positions: {},
    },
  })

  if (insErr) return { ok: false, error: insErr.message }
  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
  return { ok: true }
}

export async function createLessonInSessionForUser(
  sessionId: string,
  args: { title: string; goalText?: string | null },
  options?: { skipGraphIntegration?: boolean },
): Promise<
  { ok: true; lessonId: string } | { ok: false; error: string }
> {
  const title = args.title.trim()
  if (!title) return { ok: false, error: "Title is required." }

  const graphOk = await ensureSessionGraphForUser(sessionId)
  if (!graphOk.ok) return graphOk

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const goalRaw = args.goalText?.trim()
  const goal_text = goalRaw ? goalRaw : null

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      title,
      goal_text,
      entry_mode: "topic",
      subject_domain: "math",
      future_graph_mode: "lesson_local",
    })
    .select("id")
    .single()

  if (error) return { ok: false, error: error.message }
  if (!lesson) return { ok: false, error: "Lesson was not created." }

  if (!options?.skipGraphIntegration) {
    const linkOk = await integrateNewLessonIntoSessionGraph(sessionId, lesson.id)
    if (!linkOk.ok) return linkOk
  }

  revalidateSessionLessonScope(sessionId, lesson.id)
  return { ok: true, lessonId: lesson.id }
}

/** Deletes all lessons in the session (session_graph_edges cascade). */
export async function deleteAllLessonsInSessionForUser(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
  return { ok: true }
}

export async function updateLessonInSessionForUser(
  sessionId: string,
  lessonId: string,
  args: { title?: string; goalText?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (args.title === undefined && args.goalText === undefined) {
    return { ok: false, error: "Provide title and/or goalText to update." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: row, error: rowErr } = await supabase
    .from("lessons")
    .select("id, session_id")
    .eq("id", lessonId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (rowErr) return { ok: false, error: rowErr.message }
  if (!row || row.session_id !== sessionId) {
    return { ok: false, error: "Lesson not found in this session." }
  }

  const patch: { title?: string | null; goal_text?: string | null } = {}
  if (args.title !== undefined) {
    patch.title = args.title.trim() || null
  }
  if (args.goalText !== undefined) {
    const g = args.goalText?.trim()
    patch.goal_text = g ? g : null
  }

  const { error } = await supabase
    .from("lessons")
    .update(patch)
    .eq("id", lessonId)
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }

  revalidateSessionLessonScope(sessionId, lessonId)
  return { ok: true }
}
