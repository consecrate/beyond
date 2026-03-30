/** Layout blob stored in session skill graph metadata. */
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

/** View shape aligned with former Supabase `sessions` row. */
export type SessionRow = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
  status: string
}

/** View shape aligned with former Supabase `lessons` row. */
export type LessonRow = {
  id: string
  session_id: string
  user_id: string
  title: string | null
  goal_text: string | null
  lesson_markdown: string | null
  entry_mode: string
  subject_domain: string
  future_graph_mode: string
  status: string
  skill_tree_completed: boolean
  structured_lesson_json: null
  created_at: string
  updated_at: string
}

export type SessionWithLessons = SessionRow & {
  lessons: LessonRow[]
}
