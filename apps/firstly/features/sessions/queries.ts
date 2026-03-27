import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import type { LessonRow } from "@/features/lessons/queries"

export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]

/** Layout blob stored in `session_graphs.graph_metadata`. */
export type SessionGraphLayoutV1 = {
  version: 1
  viewport?: { x: number; y: number; zoom: number }
  positions?: Record<string, { x: number; y: number }>
}

export type SessionSkillGraphPayload = {
  graphId: string
  graphMetadata: SessionGraphLayoutV1
  edges: { from_lesson_id: string; to_lesson_id: string }[]
}

export type SessionWithLessons = SessionRow & {
  lessons: LessonRow[]
}

export async function getSessionsForUser(): Promise<SessionRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) throw error
  return data
}

/** Sessions with nested lessons for list + search (title / lesson goal). */
export async function getSessionsWithLessonsForUser(): Promise<
  SessionWithLessons[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("sessions")
    .select("*, lessons(*)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) throw error
  return data as SessionWithLessons[]
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

function coerceSessionGraphLayout(
  raw: Database["public"]["Tables"]["session_graphs"]["Row"]["graph_metadata"],
): SessionGraphLayoutV1 {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const vp = o.viewport
  const pos = o.positions
  const viewport =
    vp &&
    typeof vp === "object" &&
    !Array.isArray(vp) &&
    typeof (vp as { x?: unknown }).x === "number" &&
    typeof (vp as { y?: unknown }).y === "number" &&
    typeof (vp as { zoom?: unknown }).zoom === "number"
      ? {
          x: (vp as { x: number }).x,
          y: (vp as { y: number }).y,
          zoom: (vp as { zoom: number }).zoom,
        }
      : { x: 0, y: 0, zoom: 1 }

  const positions: Record<string, { x: number; y: number }> = {}
  if (pos && typeof pos === "object" && !Array.isArray(pos)) {
    for (const [k, v] of Object.entries(pos)) {
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        typeof (v as { x?: unknown }).x === "number" &&
        typeof (v as { y?: unknown }).y === "number"
      ) {
        positions[k] = { x: (v as { x: number }).x, y: (v as { y: number }).y }
      }
    }
  }

  return { version: 1, viewport, positions }
}

/** Skill graph for a session (one row per session). Returns null if none exists yet. */
export async function getSessionSkillGraph(
  sessionId: string,
): Promise<SessionSkillGraphPayload | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: graph, error: graphError } = await supabase
    .from("session_graphs")
    .select("id, graph_metadata")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (graphError) throw graphError
  if (!graph) return null

  const { data: edgeRows, error: edgesError } = await supabase
    .from("session_graph_edges")
    .select("from_lesson_id, to_lesson_id")
    .eq("graph_id", graph.id)

  if (edgesError) throw edgesError

  return {
    graphId: graph.id,
    graphMetadata: coerceSessionGraphLayout(graph.graph_metadata),
    edges: edgeRows ?? [],
  }
}
