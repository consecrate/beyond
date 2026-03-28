import "server-only"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

function revalidateSessionScope(sessionId: string) {
  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
}

/** Directed graph has a cycle (DFS). */
export function graphHasCycle(
  edges: { from_lesson_id: string; to_lesson_id: string }[],
  nodeIds: Set<string>,
): boolean {
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    if (!nodeIds.has(e.from_lesson_id) || !nodeIds.has(e.to_lesson_id)) continue
    adj.get(e.from_lesson_id)!.push(e.to_lesson_id)
  }
  const state = new Map<string, 0 | 1 | 2>()
  for (const id of nodeIds) state.set(id, 0)
  const dfs = (u: string): boolean => {
    state.set(u, 1)
    for (const v of adj.get(u) ?? []) {
      const s = state.get(v) ?? 0
      if (s === 1) return true
      if (s === 0 && dfs(v)) return true
    }
    state.set(u, 2)
    return false
  }
  for (const id of nodeIds) {
    if ((state.get(id) ?? 0) === 0 && dfs(id)) return true
  }
  return false
}

export async function addSessionGraphEdgeForUser(
  sessionId: string,
  fromLessonId: string,
  toLessonId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (fromLessonId === toLessonId) {
    return { ok: false, error: "Cannot add an edge from a lesson to itself." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: graph, error: gErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (gErr) return { ok: false, error: gErr.message }
  if (!graph) return { ok: false, error: "No skill graph for this session." }

  const { data: edgeRows, error: eErr } = await supabase
    .from("session_graph_edges")
    .select("from_lesson_id, to_lesson_id")
    .eq("graph_id", graph.id)

  if (eErr) return { ok: false, error: eErr.message }

  const existing = edgeRows ?? []
  if (
    existing.some(
      (e) =>
        e.from_lesson_id === fromLessonId && e.to_lesson_id === toLessonId,
    )
  ) {
    return { ok: false, error: "That edge already exists." }
  }

  const trial = [
    ...existing,
    { from_lesson_id: fromLessonId, to_lesson_id: toLessonId },
  ]
  const nodes = new Set<string>()
  for (const e of trial) {
    nodes.add(e.from_lesson_id)
    nodes.add(e.to_lesson_id)
  }
  if (graphHasCycle(trial, nodes)) {
    return { ok: false, error: "Adding this edge would create a cycle." }
  }

  const { error: insErr } = await supabase.from("session_graph_edges").insert({
    graph_id: graph.id,
    from_lesson_id: fromLessonId,
    to_lesson_id: toLessonId,
  })

  if (insErr) return { ok: false, error: insErr.message }

  revalidateSessionScope(sessionId)
  return { ok: true }
}

export async function removeSessionGraphEdgeForUser(
  sessionId: string,
  fromLessonId: string,
  toLessonId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: graph, error: gErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (gErr) return { ok: false, error: gErr.message }
  if (!graph) return { ok: false, error: "No skill graph for this session." }

  const { error: delErr } = await supabase
    .from("session_graph_edges")
    .delete()
    .eq("graph_id", graph.id)
    .eq("from_lesson_id", fromLessonId)
    .eq("to_lesson_id", toLessonId)

  if (delErr) return { ok: false, error: delErr.message }

  revalidateSessionScope(sessionId)
  return { ok: true }
}

export async function replaceSessionGraphEdgesForUser(
  sessionId: string,
  edges: { from_lesson_id: string; to_lesson_id: string }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const seen = new Set<string>()
  const uniqueEdges: { from_lesson_id: string; to_lesson_id: string }[] = []
  for (const e of edges) {
    const k = `${e.from_lesson_id}\0${e.to_lesson_id}`
    if (seen.has(k)) continue
    seen.add(k)
    uniqueEdges.push(e)
  }

  for (const e of uniqueEdges) {
    if (e.from_lesson_id === e.to_lesson_id) {
      return { ok: false, error: "Edges cannot connect a lesson to itself." }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: graph, error: gErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (gErr) return { ok: false, error: gErr.message }
  if (!graph) return { ok: false, error: "No skill graph for this session." }

  const { data: lessons, error: lErr } = await supabase
    .from("lessons")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)

  if (lErr) return { ok: false, error: lErr.message }
  const lessonIds = new Set((lessons ?? []).map((l) => l.id))
  for (const e of uniqueEdges) {
    if (!lessonIds.has(e.from_lesson_id) || !lessonIds.has(e.to_lesson_id)) {
      return {
        ok: false,
        error: "Each edge must reference two lessons in this session.",
      }
    }
  }

  const nodes = new Set<string>()
  for (const e of uniqueEdges) {
    nodes.add(e.from_lesson_id)
    nodes.add(e.to_lesson_id)
  }
  if (graphHasCycle(uniqueEdges, nodes)) {
    return { ok: false, error: "That set of edges contains a cycle." }
  }

  const { error: delErr } = await supabase
    .from("session_graph_edges")
    .delete()
    .eq("graph_id", graph.id)

  if (delErr) return { ok: false, error: delErr.message }

  if (uniqueEdges.length > 0) {
    const { error: insErr } = await supabase.from("session_graph_edges").insert(
      uniqueEdges.map((e) => ({
        graph_id: graph.id,
        from_lesson_id: e.from_lesson_id,
        to_lesson_id: e.to_lesson_id,
      })),
    )
    if (insErr) return { ok: false, error: insErr.message }
  }

  revalidateSessionScope(sessionId)
  return { ok: true }
}

/**
 * After a new lesson is added, attach it to the session skill graph so the
 * graph stays weakly connected: either a full chain by `created_at` when there
 * were no edges among other lessons, or one edge from each current sink to the
 * new lesson (natural “capstone” fan-in). Skips if the new lesson already has
 * any edge to another lesson in the session.
 */
export async function integrateNewLessonIntoSessionGraph(
  sessionId: string,
  newLessonId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: lessonRows, error: lErr } = await supabase
    .from("lessons")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (lErr) return { ok: false, error: lErr.message }
  const lessons = lessonRows ?? []
  if (lessons.length <= 1) return { ok: true }

  const lessonIds = new Set(lessons.map((l) => l.id))
  if (!lessonIds.has(newLessonId)) {
    return { ok: false, error: "New lesson not in session." }
  }

  const { data: graph, error: gErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (gErr) return { ok: false, error: gErr.message }
  if (!graph) return { ok: false, error: "No skill graph for this session." }

  const { data: edgeRows, error: eErr } = await supabase
    .from("session_graph_edges")
    .select("from_lesson_id, to_lesson_id")
    .eq("graph_id", graph.id)

  if (eErr) return { ok: false, error: eErr.message }
  const edges = edgeRows ?? []

  const linkedToNew = edges.some(
    (e) =>
      (e.from_lesson_id === newLessonId || e.to_lesson_id === newLessonId) &&
      lessonIds.has(e.from_lesson_id) &&
      lessonIds.has(e.to_lesson_id),
  )
  if (linkedToNew) return { ok: true }

  const otherIds = new Set<string>()
  for (const l of lessons) {
    if (l.id !== newLessonId) otherIds.add(l.id)
  }

  const edgesAmongOthers = edges.filter(
    (e) => otherIds.has(e.from_lesson_id) && otherIds.has(e.to_lesson_id),
  )

  if (edgesAmongOthers.length === 0) {
    const chainEdges: { from_lesson_id: string; to_lesson_id: string }[] = []
    for (let i = 0; i < lessons.length - 1; i++) {
      chainEdges.push({
        from_lesson_id: lessons[i]!.id,
        to_lesson_id: lessons[i + 1]!.id,
      })
    }
    return replaceSessionGraphEdgesForUser(sessionId, chainEdges)
  }

  const outgoingFromOther = new Set<string>()
  for (const e of edgesAmongOthers) {
    outgoingFromOther.add(e.from_lesson_id)
  }
  const sinks = [...otherIds].filter((id) => !outgoingFromOther.has(id))

  const extra: { from_lesson_id: string; to_lesson_id: string }[] = sinks.map(
    (s) => ({ from_lesson_id: s, to_lesson_id: newLessonId }),
  )

  return replaceSessionGraphEdgesForUser(sessionId, [
    ...edgesAmongOthers,
    ...extra,
  ])
}
