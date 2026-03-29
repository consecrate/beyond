import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"

import type {
  LessonRow,
  SessionGraphLayoutV1,
  SessionRow,
  SessionSkillGraphPayload,
  SessionWithLessons,
} from "@/features/firstly/data-types"
import type {
  FirstlyLesson,
  FirstlyRoot,
  FirstlySession,
  FirstlySessionGraph,
} from "@/features/jazz/schema"

export function coValueId(v: { $jazz: { readonly id: string } }): string {
  return v.$jazz.id
}

const DEFAULT_LAYOUT: SessionGraphLayoutV1 = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  positions: {},
}

export function parseGraphMetadataJson(raw: string): SessionGraphLayoutV1 {
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== "object" || Array.isArray(o)) return DEFAULT_LAYOUT
    const r = o as Record<string, unknown>
    if (r.version !== 1) return DEFAULT_LAYOUT
    const vp = r.viewport
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
    const pos = r.positions
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
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function stringifyGraphMetadata(layout: SessionGraphLayoutV1): string {
  return JSON.stringify(layout)
}

export function sessionGraphToPayload(
  skillGraph: Loaded<typeof FirstlySessionGraph>,
): SessionSkillGraphPayload {
  assertLoaded(skillGraph)
  const edgesList = skillGraph.edges
  assertLoaded(edgesList)
  const edges = [...edgesList].map((e) => {
    assertLoaded(e)
    return {
      from_lesson_id: e.from_lesson_id,
      to_lesson_id: e.to_lesson_id,
    }
  })
  return {
    graphId: coValueId(skillGraph),
    graphMetadata: parseGraphMetadataJson(skillGraph.graphMetadataJson),
    edges,
  }
}

export function lessonToRow(
  sessionId: string,
  userId: string,
  lesson: Loaded<typeof FirstlyLesson>,
): LessonRow {
  assertLoaded(lesson)
  const title = lesson.title.trim()
  const goal = lesson.goal_text.trim()
  const md = lesson.lesson_markdown
  return {
    id: coValueId(lesson),
    session_id: sessionId,
    user_id: userId,
    title: title === "" ? null : lesson.title,
    goal_text: goal === "" ? null : lesson.goal_text,
    lesson_markdown: md.trim() === "" ? null : md,
    entry_mode: lesson.entry_mode,
    subject_domain: lesson.subject_domain,
    future_graph_mode: lesson.future_graph_mode,
    status: lesson.status,
    structured_lesson_json: null,
    created_at: lesson.created_at,
    updated_at: lesson.updated_at,
  }
}

export function sessionToRow(session: Loaded<typeof FirstlySession>): SessionRow {
  assertLoaded(session)
  const title = session.title.trim()
  return {
    id: coValueId(session),
    title: title === "" ? null : session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    status: session.status,
  }
}

export function sessionWithLessons(
  session: Loaded<typeof FirstlySession>,
  userId: string,
): SessionWithLessons {
  assertLoaded(session)
  const sid = coValueId(session)
  const lessonsList = session.lessons
  assertLoaded(lessonsList)
  const lessons = [...lessonsList].map((l) => {
    assertLoaded(l)
    return lessonToRow(sid, userId, l)
  })
  return {
    ...sessionToRow(session),
    lessons,
  }
}

export function findSession(
  root: Loaded<typeof FirstlyRoot>,
  sessionId: string,
): Loaded<typeof FirstlySession> | undefined {
  const sessions = root.sessions
  assertLoaded(sessions)
  for (const s of [...sessions]) {
    assertLoaded(s)
    if (coValueId(s) === sessionId) return s as Loaded<typeof FirstlySession>
  }
  return undefined
}

export function findLessonInRoot(
  root: Loaded<typeof FirstlyRoot>,
  lessonId: string,
): { session: Loaded<typeof FirstlySession>; lesson: Loaded<typeof FirstlyLesson> } | undefined {
  const sessions = root.sessions
  assertLoaded(sessions)
  for (const s of [...sessions]) {
    assertLoaded(s)
    const lessons = s.lessons
    assertLoaded(lessons)
    for (const l of [...lessons]) {
      assertLoaded(l)
      if (coValueId(l) === lessonId) {
        return { session: s as Loaded<typeof FirstlySession>, lesson: l as Loaded<typeof FirstlyLesson> }
      }
    }
  }
  return undefined
}
