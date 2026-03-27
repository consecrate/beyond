import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai"
import { z } from "zod"

import {
  createLessonInSessionForUser,
  updateLessonInSessionForUser,
} from "@/features/lessons/session-lesson-mutations"
import { getLessonsForSession } from "@/features/lessons/queries"
import {
  addSessionGraphEdgeForUser,
  removeSessionGraphEdgeForUser,
  replaceSessionGraphEdgesForUser,
} from "@/features/sessions/graph-mutations"
import { getSession, getSessionSkillGraph } from "@/features/sessions/queries"
import { resolveChatModel } from "@/lib/ai-chat-config"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

function buildSystemPrompt(args: {
  sessionTitle: string
  lessonLines: string
  edgeLines: string
}): string {
  return `You are a tutor helping organize the skill tree for session "${args.sessionTitle}".

Lessons in this session (use ONLY these UUIDs in tools — never invent ids):
${args.lessonLines}

Current prerequisite edges (from → to means "complete from before to"):
${args.edgeLines}

Use the tools to list lessons and current edges, create new lessons, update lesson title/goal, add or remove single prerequisite edges, or replace all edges at once. Prefer small changes unless the user asks for a full reset. When a new lesson is created, prerequisite links are updated automatically so it connects to the rest of the skill tree (you may still adjust edges with the tools). After creating or editing data, call listSessionLessons to confirm the new state. Explain briefly what you changed after using tools.`
}

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return new Response("Not found", { status: 404 })
  }

  const modelResult = resolveChatModel()
  if (!modelResult.ok) {
    return new Response(modelResult.message, { status: 503 })
  }

  let body: { messages: UIMessage[] }
  try {
    body = (await req.json()) as { messages: UIMessage[] }
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  if (!Array.isArray(body.messages)) {
    return new Response("Expected messages array", { status: 400 })
  }

  const [lessons, skillGraph] = await Promise.all([
    getLessonsForSession(sessionId),
    getSessionSkillGraph(sessionId),
  ])

  const title = session.title?.trim() || "Untitled session"
  const lessonLines =
    lessons.length === 0
      ? "(no lessons yet)"
      : lessons
          .map((l) => {
            const t = l.title?.trim() || "Untitled lesson"
            const g = l.goal_text?.trim()
            return g ? `- ${l.id}: ${t} — goal: ${g}` : `- ${l.id}: ${t}`
          })
          .join("\n")

  const byId = new Map(lessons.map((l) => [l.id, l.title?.trim() || "Untitled"]))
  const edgeLines =
    skillGraph && skillGraph.edges.length > 0
      ? skillGraph.edges
          .map(
            (e) =>
              `- ${byId.get(e.from_lesson_id) ?? "?"} (${e.from_lesson_id}) → ${byId.get(e.to_lesson_id) ?? "?"} (${e.to_lesson_id})`,
          )
          .join("\n")
      : "(none)"

  const system = buildSystemPrompt({
    sessionTitle: title,
    lessonLines,
    edgeLines,
  })

  const tools = {
    listSessionLessons: tool({
      description:
        "List current lessons and prerequisite edges (always up to date — use after mutations).",
      inputSchema: z.object({}),
      execute: async () => {
        const [freshLessons, freshGraph] = await Promise.all([
          getLessonsForSession(sessionId),
          getSessionSkillGraph(sessionId),
        ])
        const byId = new Map(
          freshLessons.map((l) => [l.id, l.title?.trim() || "Untitled"]),
        )
        const edgeRows = freshGraph?.edges ?? []
        return {
          lessons: freshLessons.map((l) => ({
            id: l.id,
            title: l.title?.trim() || "Untitled lesson",
            goal: l.goal_text,
          })),
          prerequisiteEdges: edgeRows.map((e) => ({
            fromLessonId: e.from_lesson_id,
            toLessonId: e.to_lesson_id,
            fromTitle: byId.get(e.from_lesson_id) ?? "?",
            toTitle: byId.get(e.to_lesson_id) ?? "?",
          })),
        }
      },
    }),
    createSessionLesson: tool({
      description:
        "Add a new lesson to this session (gets a new UUID). Use before linking prerequisites if the user asks for a new node.",
      inputSchema: z.object({
        title: z.string().min(1),
        goalText: z.string().optional(),
      }),
      execute: async ({ title, goalText }) => {
        const r = await createLessonInSessionForUser(sessionId, {
          title,
          goalText: goalText ?? null,
        })
        if (!r.ok) return { ok: false as const, error: r.error }
        return { ok: true as const, lessonId: r.lessonId }
      },
    }),
    updateSessionLesson: tool({
      description:
        "Update the title and/or learning goal of a lesson in this session (use lesson id from listSessionLessons).",
      inputSchema: z.object({
        lessonId: z.string().uuid(),
        title: z.string().optional(),
        goalText: z.string().nullable().optional(),
      }),
      execute: async ({ lessonId, title, goalText }) => {
        const r = await updateLessonInSessionForUser(sessionId, lessonId, {
          title,
          goalText,
        })
        if (!r.ok) return { ok: false as const, error: r.error }
        return { ok: true as const }
      },
    }),
    addPrerequisiteEdge: tool({
      description:
        "Add one prerequisite edge: the learner completes fromLessonId before toLessonId.",
      inputSchema: z.object({
        fromLessonId: z.string().uuid(),
        toLessonId: z.string().uuid(),
      }),
      execute: async ({ fromLessonId, toLessonId }) => {
        const r = await addSessionGraphEdgeForUser(
          sessionId,
          fromLessonId,
          toLessonId,
        )
        if (!r.ok) return { ok: false as const, error: r.error }
        return { ok: true as const }
      },
    }),
    removeSessionGraphEdge: tool({
      description: "Remove one prerequisite edge between two lessons.",
      inputSchema: z.object({
        fromLessonId: z.string().uuid(),
        toLessonId: z.string().uuid(),
      }),
      execute: async ({ fromLessonId, toLessonId }) => {
        const r = await removeSessionGraphEdgeForUser(
          sessionId,
          fromLessonId,
          toLessonId,
        )
        if (!r.ok) return { ok: false as const, error: r.error }
        return { ok: true as const }
      },
    }),
    replaceSessionGraphEdges: tool({
      description:
        "Replace the entire skill graph edge set. Each edge is prerequisite from → to.",
      inputSchema: z.object({
        edges: z.array(
          z.object({
            fromLessonId: z.string().uuid(),
            toLessonId: z.string().uuid(),
          }),
        ),
      }),
      execute: async ({ edges }) => {
        const r = await replaceSessionGraphEdgesForUser(
          sessionId,
          edges.map((e) => ({
            from_lesson_id: e.fromLessonId,
            to_lesson_id: e.toLessonId,
          })),
        )
        if (!r.ok) return { ok: false as const, error: r.error }
        return { ok: true as const, edgeCount: edges.length }
      },
    }),
  }

  const modelMessages = await convertToModelMessages(body.messages, { tools })

  const result = streamText({
    model: modelResult.model,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(15),
  })

  return result.toUIMessageStreamResponse({
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  })
}
