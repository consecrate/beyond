import type { Loaded } from "jazz-tools"
import { assertLoaded, co } from "jazz-tools"

import type { LessonRow, SessionRow, SessionSkillGraphPayload, SessionWithLessons } from "@/features/firstly/data-types"
import {
  coValueId,
  findLessonInRoot,
  findSession,
  lessonToRow,
  parseGraphMetadataJson,
  sessionGraphToPayload,
  sessionWithLessons,
  stringifyGraphMetadata,
} from "@/features/firstly/firstly-map"
import {
  FirstlyAccount,
  FirstlyLesson,
  FirstlySession,
  FirstlySessionGraph,
  SessionSkillEdge,
} from "@/features/jazz/schema"
import { graphHasCycle } from "@/features/sessions/graph-mutations"

function loadedRoot(me: Loaded<typeof FirstlyAccount>) {
  assertLoaded(me)
  assertLoaded(me.root)
  return me.root
}

function nowIso() {
  return new Date().toISOString()
}

export function getSessionsWithLessonsForUser(
  me: Loaded<typeof FirstlyAccount>,
): SessionWithLessons[] {
  const root = loadedRoot(me)
  const sessions = root.sessions
  assertLoaded(sessions)
  const uid = me.$jazz.id
  return [...sessions].map((s) => {
    assertLoaded(s)
    return sessionWithLessons(s as Loaded<typeof FirstlySession>, uid)
  })
}

export function getSessionRow(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
): SessionRow | null {
  const s = findSession(loadedRoot(me), sessionId)
  if (!s) return null
  const uid = me.$jazz.id
  const sw = sessionWithLessons(s, uid)
  return {
    id: sw.id,
    title: sw.title,
    created_at: sw.created_at,
    updated_at: sw.updated_at,
    status: sw.status,
  }
}

export function getLessonsForSessionPayload(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
): LessonRow[] {
  const s = findSession(loadedRoot(me), sessionId)
  if (!s) return []
  return sessionWithLessons(s, me.$jazz.id).lessons
}

export function getSessionSkillGraphPayload(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
): SessionSkillGraphPayload | null {
  const s = findSession(loadedRoot(me), sessionId)
  if (!s) return null
  const sg = s.skill_graph
  assertLoaded(sg)
  return sessionGraphToPayload(sg as Loaded<typeof FirstlySessionGraph>)
}

export function getLessonPayload(
  me: Loaded<typeof FirstlyAccount>,
  lessonId: string,
): LessonRow | null {
  const found = findLessonInRoot(loadedRoot(me), lessonId)
  if (!found) return null
  return lessonToRow(coValueId(found.session), me.$jazz.id, found.lesson)
}

function lessonDefaults(me: Loaded<typeof FirstlyAccount>, t: string) {
  const ts = nowIso()
  return {
    owner_account_id: me.$jazz.id,
    title: t,
    goal_text: "",
    lesson_markdown: "",
    entry_mode: "topic",
    subject_domain: "math",
    future_graph_mode: "lesson_local",
    status: "active",
    skill_tree_completed: false,
    created_at: ts,
    updated_at: ts,
  }
}

export function createSessionFromTitle(
  me: Loaded<typeof FirstlyAccount>,
  title: string | null,
): { ok: true; sessionId: string } | { ok: false; error: string } {
  const trimmed = title?.trim() ?? ""
  const sessionTitle = trimmed === "" ? "" : trimmed

  const root = loadedRoot(me)
  const sessions = root.sessions
  assertLoaded(sessions)

  const sampleLessonTitles = ["Foundations", "Core skills", "Capstone"] as const
  const lessonRows: Loaded<typeof FirstlyLesson>[] = []

  for (const t of sampleLessonTitles) {
    const d = lessonDefaults(me, t)
    const lesson = FirstlyLesson.create(d, me)
    lessonRows.push(lesson as Loaded<typeof FirstlyLesson>)
  }

  const verticalGap = 140
  const positions: Record<string, { x: number; y: number }> = {}
  lessonRows.forEach((row, i) => {
    positions[coValueId(row)] = { x: 0, y: i * verticalGap }
  })

  const graphMetadata = stringifyGraphMetadata({
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    positions,
  })

  const [a, b, c] = lessonRows
  const edges = [
    SessionSkillEdge.create(
      { from_lesson_id: coValueId(a), to_lesson_id: coValueId(b) },
      me,
    ),
    SessionSkillEdge.create(
      { from_lesson_id: coValueId(b), to_lesson_id: coValueId(c) },
      me,
    ),
  ]

  const skillGraph = FirstlySessionGraph.create(
    {
      graphMetadataJson: graphMetadata,
      edges: co.list(SessionSkillEdge).create(edges, me),
    },
    me,
  )

  const ts = nowIso()
  const session = FirstlySession.create(
    {
      title: sessionTitle,
      status: "active",
      created_at: ts,
      updated_at: ts,
      lessons: co.list(FirstlyLesson).create(lessonRows, me),
      skill_graph: skillGraph,
    },
    me,
  )

  sessions.$jazz.push(session)
  return { ok: true, sessionId: coValueId(session) }
}

export function updateSessionMetadata(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  title: string | null,
  goalText: string | null,
): { ok: true } | { ok: false; error: string } {
  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const t = title?.trim() ?? ""
  const g = goalText?.trim() ?? ""
  const ts = nowIso()
  session.$jazz.applyDiff({
    title: t,
    updated_at: ts,
  })

  const lessons = session.lessons
  assertLoaded(lessons)
  const list = [...lessons].sort((a, b) => {
    assertLoaded(a)
    assertLoaded(b)
    return a.created_at.localeCompare(b.created_at)
  })
  const rootLesson = list[0]
  if (rootLesson) {
    assertLoaded(rootLesson)
    rootLesson.$jazz.applyDiff({
      title: t === "" ? "" : t,
      goal_text: g,
      updated_at: ts,
    })
  }

  return { ok: true }
}

export function updateLessonFields(
  me: Loaded<typeof FirstlyAccount>,
  lessonId: string,
  patch: {
    title?: string | null
    goal_text?: string | null
    lesson_markdown?: string | null
    skill_tree_completed?: boolean
  },
): { ok: true } | { ok: false; error: string } {
  const found = findLessonInRoot(loadedRoot(me), lessonId)
  if (!found) return { ok: false, error: "Lesson not found." }

  const lesson = found.lesson
  assertLoaded(lesson)
  const ts = nowIso()
  const next: Partial<{
    title: string
    goal_text: string
    lesson_markdown: string
    skill_tree_completed: boolean
    updated_at: string
  }> = { updated_at: ts }

  if (patch.title !== undefined) {
    next.title = patch.title?.trim() ?? ""
  }
  if (patch.goal_text !== undefined) {
    const g = patch.goal_text?.trim() ?? ""
    next.goal_text = g
  }
  if (patch.lesson_markdown !== undefined) {
    const raw = patch.lesson_markdown
    if (raw === null) {
      next.lesson_markdown = ""
    } else {
      const trimmed = raw.trim()
      next.lesson_markdown = trimmed === "" ? "" : raw
    }
  }
  if (patch.skill_tree_completed !== undefined) {
    next.skill_tree_completed = patch.skill_tree_completed
  }

  lesson.$jazz.applyDiff(next)
  return { ok: true }
}

export function deleteLessonById(
  me: Loaded<typeof FirstlyAccount>,
  lessonId: string,
): { ok: true } | { ok: false; error: string } {
  const found = findLessonInRoot(loadedRoot(me), lessonId)
  if (!found) return { ok: false, error: "Lesson not found." }

  const lessons = found.session.lessons
  assertLoaded(lessons)
  const idx = [...lessons].findIndex((l) => {
    assertLoaded(l)
    return coValueId(l) === lessonId
  })
  if (idx < 0) return { ok: false, error: "Lesson not found." }

  lessons.$jazz.splice(idx, 1)

  const sg = found.session.skill_graph
  assertLoaded(sg)
  const edges = sg.edges
  assertLoaded(edges)
  const filtered = [...edges].filter((e) => {
    assertLoaded(e)
    return (
      e.from_lesson_id !== lessonId && e.to_lesson_id !== lessonId
    )
  })
  const len = edges.length
  if (len > 0) {
    edges.$jazz.splice(0, len, ...filtered)
  }

  const meta = parseGraphMetadataJson(sg.graphMetadataJson)
  if (meta.positions && meta.positions[lessonId]) {
    const { [lessonId]: _, ...rest } = meta.positions
    void _
    sg.$jazz.applyDiff({
      graphMetadataJson: stringifyGraphMetadata({
        ...meta,
        positions: rest,
      }),
    })
  }

  found.session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true }
}

export function deleteSessionById(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
): { ok: true } | { ok: false; error: string } {
  const root = loadedRoot(me)
  const sessions = root.sessions
  assertLoaded(sessions)
  const idx = [...sessions].findIndex((s) => {
    assertLoaded(s)
    return coValueId(s) === sessionId
  })
  if (idx < 0) return { ok: false, error: "Session not found." }
  sessions.$jazz.splice(idx, 1)
  return { ok: true }
}

export function ensureSessionGraph(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
): { ok: true } | { ok: false; error: string } {
  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }
  const sg = session.skill_graph
  assertLoaded(sg)
  return { ok: true }
}

export function createLessonInSession(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  args: { title: string; goalText?: string | null },
  options?: { skipGraphIntegration?: boolean },
): { ok: true; lessonId: string } | { ok: false; error: string } {
  const title = args.title.trim()
  if (!title) return { ok: false, error: "Title is required." }

  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const gRaw = args.goalText?.trim()
  const ts = nowIso()
  const lesson = FirstlyLesson.create(
    {
      owner_account_id: me.$jazz.id,
      title,
      goal_text: gRaw ? gRaw : "",
      lesson_markdown: "",
      entry_mode: "topic",
      subject_domain: "math",
      future_graph_mode: "lesson_local",
      status: "active",
      skill_tree_completed: false,
      created_at: ts,
      updated_at: ts,
    },
    me,
  )

  const lessons = session.lessons
  assertLoaded(lessons)
  lessons.$jazz.push(lesson)

  const sessionIdStr = coValueId(session)
  const newLessonId = coValueId(lesson as Loaded<typeof FirstlyLesson>)

  if (!options?.skipGraphIntegration) {
    const linkOk = integrateNewLessonIntoSessionGraph(
      me,
      sessionIdStr,
      newLessonId,
    )
    if (!linkOk.ok) return linkOk
  }

  session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true, lessonId: newLessonId }
}

export function updateLessonInSession(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  lessonId: string,
  args: { title?: string; goalText?: string | null },
): { ok: true } | { ok: false; error: string } {
  if (args.title === undefined && args.goalText === undefined) {
    return { ok: false, error: "Provide title and/or goalText to update." }
  }

  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const found = findLessonInRoot(loadedRoot(me), lessonId)
  if (!found || coValueId(found.session) !== sessionId) {
    return { ok: false, error: "Lesson not found in this session." }
  }

  const lesson = found.lesson
  assertLoaded(lesson)
  const ts = nowIso()
  const patch: Partial<{ title: string; goal_text: string; updated_at: string }> = {
    updated_at: ts,
  }
  if (args.title !== undefined) {
    patch.title = args.title.trim() || ""
  }
  if (args.goalText !== undefined) {
    const g = args.goalText?.trim()
    patch.goal_text = g ? g : ""
  }
  lesson.$jazz.applyDiff(patch)
  session.$jazz.applyDiff({ updated_at: ts })
  return { ok: true }
}

export function replaceSessionGraphEdges(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  edges: { from_lesson_id: string; to_lesson_id: string }[],
): { ok: true } | { ok: false; error: string } {
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

  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const lessonList = session.lessons
  assertLoaded(lessonList)
  const lessonIds = new Set(
    [...lessonList].map((l) => {
      assertLoaded(l)
      return coValueId(l)
    }),
  )
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

  const sg = session.skill_graph
  assertLoaded(sg)
  const edgeList = sg.edges
  assertLoaded(edgeList)
  const newEdges = uniqueEdges.map((e) =>
    SessionSkillEdge.create(
      { from_lesson_id: e.from_lesson_id, to_lesson_id: e.to_lesson_id },
      me,
    ),
  )
  const len = edgeList.length
  if (len > 0) {
    edgeList.$jazz.splice(0, len, ...newEdges)
  } else if (newEdges.length > 0) {
    edgeList.$jazz.push(...newEdges)
  }

  session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true }
}

export function addSessionGraphEdge(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  fromLessonId: string,
  toLessonId: string,
): { ok: true } | { ok: false; error: string } {
  if (fromLessonId === toLessonId) {
    return { ok: false, error: "Cannot add an edge from a lesson to itself." }
  }

  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const sg = session.skill_graph
  assertLoaded(sg)
  const edgeList = sg.edges
  assertLoaded(edgeList)
  const existing = [...edgeList].map((e) => {
    assertLoaded(e)
    return { from_lesson_id: e.from_lesson_id, to_lesson_id: e.to_lesson_id }
  })

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

  edgeList.$jazz.push(
    SessionSkillEdge.create(
      { from_lesson_id: fromLessonId, to_lesson_id: toLessonId },
      me,
    ),
  )
  session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true }
}

export function removeSessionGraphEdge(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  fromLessonId: string,
  toLessonId: string,
): { ok: true } | { ok: false; error: string } {
  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const sg = session.skill_graph
  assertLoaded(sg)
  const edgeList = sg.edges
  assertLoaded(edgeList)
  const idx = [...edgeList].findIndex((e) => {
    assertLoaded(e)
    return (
      e.from_lesson_id === fromLessonId && e.to_lesson_id === toLessonId
    )
  })
  if (idx < 0) return { ok: false, error: "Edge not found." }

  edgeList.$jazz.splice(idx, 1)
  session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true }
}

export function integrateNewLessonIntoSessionGraph(
  me: Loaded<typeof FirstlyAccount>,
  sessionId: string,
  newLessonId: string,
): { ok: true } | { ok: false; error: string } {
  const session = findSession(loadedRoot(me), sessionId)
  if (!session) return { ok: false, error: "Session not found." }

  const lessonList = session.lessons
  assertLoaded(lessonList)
  const lessonRows = [...lessonList].sort((a, b) => {
    assertLoaded(a)
    assertLoaded(b)
    return a.created_at.localeCompare(b.created_at)
  })
  if (lessonRows.length <= 1) return { ok: true }

  const lessonIds = new Set(lessonRows.map((l) => coValueId(l as Loaded<typeof FirstlyLesson>)))
  if (!lessonIds.has(newLessonId)) {
    return { ok: false, error: "New lesson not in session." }
  }

  const sg = session.skill_graph
  assertLoaded(sg)
  const edgeList = sg.edges
  assertLoaded(edgeList)
  const edges = [...edgeList].map((e) => {
    assertLoaded(e)
    return { from_lesson_id: e.from_lesson_id, to_lesson_id: e.to_lesson_id }
  })

  const linkedToNew = edges.some(
    (e) =>
      (e.from_lesson_id === newLessonId || e.to_lesson_id === newLessonId) &&
      lessonIds.has(e.from_lesson_id) &&
      lessonIds.has(e.to_lesson_id),
  )
  if (linkedToNew) return { ok: true }

  const otherIds = new Set<string>()
  for (const l of lessonRows) {
    const id = coValueId(l as Loaded<typeof FirstlyLesson>)
    if (id !== newLessonId) otherIds.add(id)
  }

  const edgesAmongOthers = edges.filter(
    (e) => otherIds.has(e.from_lesson_id) && otherIds.has(e.to_lesson_id),
  )

  if (edgesAmongOthers.length === 0) {
    const chainEdges: { from_lesson_id: string; to_lesson_id: string }[] = []
    for (let i = 0; i < lessonRows.length - 1; i++) {
      chainEdges.push({
        from_lesson_id: coValueId(lessonRows[i] as Loaded<typeof FirstlyLesson>),
        to_lesson_id: coValueId(lessonRows[i + 1] as Loaded<typeof FirstlyLesson>),
      })
    }
    return replaceSessionGraphEdges(me, sessionId, chainEdges)
  }

  const outgoingFromOther = new Set<string>()
  for (const e of edgesAmongOthers) {
    outgoingFromOther.add(e.from_lesson_id)
  }
  const sinks = [...otherIds].filter((id) => !outgoingFromOther.has(id))

  const extra: { from_lesson_id: string; to_lesson_id: string }[] = sinks.map(
    (s) => ({ from_lesson_id: s, to_lesson_id: newLessonId }),
  )

  return replaceSessionGraphEdges(me, sessionId, [
    ...edgesAmongOthers,
    ...extra,
  ])
}

/** Replaces all lessons and edges (skill tree JSON import). */
export function replaceLessonsAndEdgesFromImport(
  me: Loaded<typeof FirstlyAccount>,
  session: Loaded<typeof FirstlySession>,
  newLessons: Loaded<typeof FirstlyLesson>[],
  edgeRows: { from_lesson_id: string; to_lesson_id: string }[],
): { ok: true } | { ok: false; error: string } {
  const lessons = session.lessons
  assertLoaded(lessons)
  const oldLen = lessons.length
  if (oldLen > 0) {
    lessons.$jazz.splice(0, oldLen, ...newLessons)
  } else if (newLessons.length > 0) {
    lessons.$jazz.push(...newLessons)
  }

  const sg = session.skill_graph
  assertLoaded(sg)
  sg.$jazz.applyDiff({
    graphMetadataJson: stringifyGraphMetadata({
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      positions: {},
    }),
  })

  const edgeList = sg.edges
  assertLoaded(edgeList)
  const elen = edgeList.length
  const newEdges = edgeRows.map((e) =>
    SessionSkillEdge.create(
      { from_lesson_id: e.from_lesson_id, to_lesson_id: e.to_lesson_id },
      me,
    ),
  )
  if (elen > 0) {
    edgeList.$jazz.splice(0, elen, ...newEdges)
  } else if (newEdges.length > 0) {
    edgeList.$jazz.push(...newEdges)
  }

  session.$jazz.applyDiff({ updated_at: nowIso() })
  return { ok: true }
}
