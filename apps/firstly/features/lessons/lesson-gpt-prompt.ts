/**
 * Copy-paste prompt for a custom GPT that emits a Markdown lesson document
 * (see LESSON_GENEARTION.md). Keep in sync with product rules there.
 */

import type { LessonRow } from "@/features/firstly/data-types"

export type LessonPromptFields = {
  title: string | null
  goal_text: string | null
  /** `lessons.entry_mode`: `topic` | `problem_set` | `mixed` */
  entry_mode: string
}

/**
 * Pedagogical shape for generation. `topic` → concept; `problem_set` → problem;
 * `mixed` is explicit (both framing and drill).
 */
export type LessonKindForPrompt = "concept" | "problem" | "mixed"

export function lessonKindForPrompt(entryMode: string): LessonKindForPrompt {
  if (entryMode === "problem_set") return "problem"
  if (entryMode === "mixed") return "mixed"
  return "concept"
}

export type LessonSkillTreePromptInput = {
  currentLessonId: string
  sessionLessons: LessonRow[]
  edges: { from_lesson_id: string; to_lesson_id: string }[]
}

function lessonLabel(l: LessonRow): string {
  const title = l.title?.trim() || "Untitled lesson"
  const goal = l.goal_text?.trim()
  const goalPart = goal ? ` — goal: ${goal}` : ""
  return `${title}${goalPart}`
}

/** Prereqs with stored lesson Markdown are treated as “authored / ready” for the prompt. */
function buildSkillTreeSection(input: LessonSkillTreePromptInput): string {
  const { currentLessonId, sessionLessons, edges } = input
  const byId = new Map(sessionLessons.map((l) => [l.id, l]))

  const prereqIds = [
    ...new Set(
      edges.filter((e) => e.to_lesson_id === currentLessonId).map((e) => e.from_lesson_id),
    ),
  ]
  const downstreamIds = [
    ...new Set(
      edges.filter((e) => e.from_lesson_id === currentLessonId).map((e) => e.to_lesson_id),
    ),
  ]

  const authored: string[] = []
  const notAuthored: string[] = []
  for (const id of prereqIds) {
    const l = byId.get(id)
    if (!l) continue
    const line = `- ${lessonLabel(l)}`
    if (l.lesson_markdown?.trim()) authored.push(line)
    else notAuthored.push(line)
  }

  const downstream = downstreamIds
    .map((id) => byId.get(id))
    .filter((l): l is LessonRow => l != null)
    .map((l) => `- ${lessonLabel(l)}`)

  const lines: string[] = []

  if (prereqIds.length === 0) {
    lines.push("- Prerequisite lessons on this graph: (none linked)")
  } else {
    if (authored.length) {
      lines.push(
        "- Prerequisite lessons with saved Markdown (treat as already covered in the path):",
        ...authored,
      )
    }
    if (notAuthored.length) {
      lines.push(
        "- Prerequisite lessons linked but without saved lesson Markdown yet (positioning only; do not assume content):",
        ...notAuthored,
      )
    }
  }

  if (downstream.length === 0) {
    lines.push(
      "- Where this lesson leads on the graph: (no downstream lessons linked — this may be a terminal or standalone node)",
    )
  } else {
    lines.push(
      "- Downstream lessons this one prepares the learner for (aim toward aligning depth and leaving hooks):",
      ...downstream,
    )
  }

  return lines.join("\n")
}

export function buildLessonGptPrompt(
  lesson: LessonPromptFields,
  skillTree?: LessonSkillTreePromptInput | null,
): string {
  const title = lesson.title?.trim() || "(untitled lesson)"
  const goal = lesson.goal_text?.trim() || "(no goal set yet — infer a narrow goal from the title or ask the user)"
  const kind = lessonKindForPrompt(lesson.entry_mode)

  const skillTreeBlock =
    skillTree && skillTree.sessionLessons.length > 0
      ? `

Skill tree context
${buildSkillTreeSection(skillTree)}`
      : ""

  return `Generate the following lesson:

- Title: ${title}
- Goal: ${goal}
- Lesson kind: ${kind}${skillTreeBlock}`
}
