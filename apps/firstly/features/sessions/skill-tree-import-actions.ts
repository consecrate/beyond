"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

import { graphHasCycle } from "@/features/sessions/graph-mutations"

export type SkillTreeImportState = {
  error?: string
}

type ImportLesson = {
  key: string
  kind: "concept" | "problem"
  title: string
  goalText: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function parsePayload(raw: unknown):
  | { ok: true; lessons: ImportLesson[]; edges: { from: string; to: string }[] }
  | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "JSON must be an object with lessons and edges." }
  }
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.lessons) || !Array.isArray(o.edges)) {
    return { ok: false, error: "Missing lessons array or edges array." }
  }
  const lessons: ImportLesson[] = []
  const seenKeys = new Set<string>()
  for (let i = 0; i < o.lessons.length; i++) {
    const row = o.lessons[i]
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `lessons[${i}] must be an object.` }
    }
    const L = row as Record<string, unknown>
    if (!isNonEmptyString(L.key)) {
      return { ok: false, error: `lessons[${i}].key must be a non-empty string.` }
    }
    const key = L.key.trim()
    if (seenKeys.has(key)) {
      return { ok: false, error: `Duplicate lesson key "${key}".` }
    }
    seenKeys.add(key)
    if (L.kind !== "concept" && L.kind !== "problem") {
      return {
        ok: false,
        error: `lessons[${i}].kind must be "concept" or "problem".`,
      }
    }
    if (!isNonEmptyString(L.title)) {
      return { ok: false, error: `lessons[${i}].title must be a non-empty string.` }
    }
    if (!isNonEmptyString(L.goalText)) {
      return { ok: false, error: `lessons[${i}].goalText must be a non-empty string.` }
    }
    lessons.push({
      key,
      kind: L.kind,
      title: L.title.trim(),
      goalText: L.goalText.trim(),
    })
  }
  if (lessons.length === 0) {
    return { ok: false, error: "At least one lesson is required." }
  }

  const edges: { from: string; to: string }[] = []
  const edgeSeen = new Set<string>()
  for (let i = 0; i < o.edges.length; i++) {
    const row = o.edges[i]
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `edges[${i}] must be an object.` }
    }
    const E = row as Record<string, unknown>
    if (!isNonEmptyString(E.from) || !isNonEmptyString(E.to)) {
      return { ok: false, error: `edges[${i}] needs non-empty from and to strings.` }
    }
    const from = E.from.trim()
    const to = E.to.trim()
    if (from === to) {
      return { ok: false, error: `edges[${i}] cannot be a self-loop.` }
    }
    if (!seenKeys.has(from) || !seenKeys.has(to)) {
      return {
        ok: false,
        error: `edges[${i}] references unknown lesson key (from/to must match lessons).`,
      }
    }
    const ek = `${from}\0${to}`
    if (edgeSeen.has(ek)) continue
    edgeSeen.add(ek)
    edges.push({ from, to })
  }

  const keySet = new Set(seenKeys)
  const asDbEdges = edges.map((e) => ({
    from_lesson_id: e.from,
    to_lesson_id: e.to,
  }))
  if (graphHasCycle(asDbEdges, keySet)) {
    return { ok: false, error: "Edges contain a cycle; skill tree must be a DAG." }
  }

  return { ok: true, lessons, edges }
}

export async function applySkillTreeImport(
  _prev: SkillTreeImportState,
  formData: FormData,
): Promise<SkillTreeImportState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not signed in." }

  const sessionId = (formData.get("sessionId") as string)?.trim()
  if (!sessionId) return { error: "Missing session." }

  const { data: sessionRow, error: sessionErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (sessionErr) return { error: sessionErr.message }
  if (!sessionRow) return { error: "Session not found." }

  const jsonRaw = (formData.get("json") as string)?.trim() ?? ""
  if (!jsonRaw) return { error: "Paste JSON to import." }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonRaw) as unknown
  } catch {
    return { error: "Invalid JSON." }
  }

  const payload = parsePayload(parsed)
  if (!payload.ok) return { error: payload.error }

  const { lessons, edges } = payload

  const { error: delErr } = await supabase
    .from("lessons")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", user.id)

  if (delErr) return { error: delErr.message }

  const insertRows = lessons.map((L) => ({
    user_id: user.id,
    session_id: sessionId,
    title: L.title,
    goal_text: L.goalText,
    entry_mode: L.kind === "problem" ? ("problem_set" as const) : ("topic" as const),
    status: "active" as const,
    subject_domain: "math",
    future_graph_mode: "lesson_local" as const,
  }))

  const { data: inserted, error: insErr } = await supabase
    .from("lessons")
    .insert(insertRows)
    .select("id")

  if (insErr) return { error: insErr.message }
  if (!inserted || inserted.length !== lessons.length) {
    return { error: "Could not create all lessons." }
  }

  const keyToId = new Map<string, string>()
  for (let i = 0; i < lessons.length; i++) {
    keyToId.set(lessons[i]!.key, inserted[i]!.id)
  }

  const { data: graphRowInitial, error: graphReadErr } = await supabase
    .from("session_graphs")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (graphReadErr) return { error: graphReadErr.message }

  let graphRow = graphRowInitial

  if (!graphRow) {
    const graphMetadata = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
    }
    const { data: g, error: gInsErr } = await supabase
      .from("session_graphs")
      .insert({
        session_id: sessionId,
        graph_metadata: graphMetadata,
      })
      .select("id")
      .single()

    if (gInsErr) return { error: gInsErr.message }
    if (!g) return { error: "Could not create skill graph." }
    graphRow = g
  } else {
    const { error: metaErr } = await supabase
      .from("session_graphs")
      .update({
        graph_metadata: {
          version: 1,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      })
      .eq("id", graphRow.id)

    if (metaErr) return { error: metaErr.message }
  }

  const graphId = graphRow.id

  if (edges.length > 0) {
    const edgeRows = edges.map((e) => ({
      graph_id: graphId,
      from_lesson_id: keyToId.get(e.from)!,
      to_lesson_id: keyToId.get(e.to)!,
    }))
    const { error: edgeErr } = await supabase.from("session_graph_edges").insert(edgeRows)
    if (edgeErr) return { error: edgeErr.message }
  }

  revalidatePath(`/sessions/${sessionId}`)
  revalidatePath("/sessions")
  return {}
}
