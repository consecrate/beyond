import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"

import { coValueId, findSession } from "@/features/firstly/firstly-map"
import { replaceLessonsAndEdgesFromImport } from "@/features/firstly/jazz-firstly-mutations"
import type { FirstlyRoot } from "@/features/jazz/schema"
import { FirstlyAccount, FirstlyLesson } from "@/features/jazz/schema"
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

function nowIso() {
  return new Date().toISOString()
}

function loadedRoot(me: Loaded<typeof FirstlyAccount>) {
  assertLoaded(me)
  assertLoaded(me.root)
  return me.root as Loaded<typeof FirstlyRoot>
}

/** Replace session lessons and graph edges from validated import payload. */
export function applySkillTreeImportPayload(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  lessons: ImportLesson[],
  edges: { from: string; to: string }[],
): { ok: true } | { ok: false; error: string } {
  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const ts = nowIso()
  const newLessons: Loaded<typeof FirstlyLesson>[] = []
  for (const L of lessons) {
    const lesson = FirstlyLesson.create(
      {
        owner_account_id: me.$jazz.id,
        title: L.title,
        goal_text: L.goalText,
        lesson_markdown: "",
        entry_mode: L.kind === "problem" ? "problem_set" : "topic",
        subject_domain: "math",
        future_graph_mode: "lesson_local",
        status: "active",
        skill_tree_completed: false,
        created_at: ts,
        updated_at: ts,
      },
      me,
    )
    newLessons.push(lesson as Loaded<typeof FirstlyLesson>)
  }

  const keyToId = new Map<string, string>()
  for (let i = 0; i < lessons.length; i++) {
    keyToId.set(lessons[i]!.key, coValueId(newLessons[i]!))
  }

  const edgeRows = edges.map((e) => ({
    from_lesson_id: keyToId.get(e.from)!,
    to_lesson_id: keyToId.get(e.to)!,
  }))

  return replaceLessonsAndEdgesFromImport(me, session, newLessons, edgeRows)
}

export function applySkillTreeImport(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  jsonRaw: string,
): SkillTreeImportState {
  const trimmed = jsonRaw.trim()
  if (!trimmed) return { error: "Paste JSON to import." }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    return { error: "Invalid JSON." }
  }

  const payload = parsePayload(parsed)
  if (!payload.ok) return { error: payload.error }

  const r = applySkillTreeImportPayload(me, sessionId, payload.lessons, payload.edges)
  if (!r.ok) return { error: r.error }
  return {}
}
