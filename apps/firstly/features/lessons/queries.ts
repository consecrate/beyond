import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type LessonRow = Database["public"]["Tables"]["lessons"]["Row"]

export async function getLessonsForUser(options?: {
  limit?: number
}): Promise<LessonRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  let q = supabase
    .from("lessons")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (options?.limit != null) q = q.limit(options.limit)

  const { data, error } = await q

  if (error) throw error
  return data
}

export async function getLesson(lessonId: string): Promise<LessonRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle()

  if (error) throw error
  return data
}
