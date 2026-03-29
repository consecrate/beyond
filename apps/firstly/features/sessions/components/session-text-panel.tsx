import { LessonOverviewContent } from "@/features/lessons/components/lesson-overview-content"
import type { LessonRow, SessionSkillGraphPayload } from "@/features/firstly/data-types"
import { cn } from "@beyond/design-system"

type Props = {
  lessons: LessonRow[]
  skillGraph: SessionSkillGraphPayload | null
  selectedLessonId?: string | null
  className?: string
}

export function SessionTextPanel({
  lessons,
  skillGraph,
  selectedLessonId,
  className,
}: Props) {
  const sorted = [...lessons].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )

  const selectedLesson =
    selectedLessonId != null
      ? lessons.find((l) => l.id === selectedLessonId)
      : undefined

  return (
    <div
      className={cn(
        "h-full min-h-0 overflow-y-auto bg-background",
        className,
      )}
    >
      <div className="mx-auto max-w-prose space-y-8 px-5 py-6 md:px-8">
        {selectedLesson ? (
          <LessonOverviewContent
            lesson={selectedLesson}
            skillTree={{
              currentLessonId: selectedLesson.id,
              sessionLessons: lessons,
              edges: skillGraph?.edges ?? [],
            }}
          />
        ) : sorted.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            No lessons in this session yet. Add lessons to see titles and goals
            here; the skill tree on the left updates as the graph grows.
          </p>
        ) : selectedLessonId != null && !selectedLesson ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Lesson not found in this session.
          </p>
        ) : (
          sorted.map((lesson) => (
            <article key={lesson.id} className="space-y-2">
              <h2 className="font-display text-base font-medium tracking-[-0.02em] text-foreground">
                {lesson.title?.trim() || "Untitled lesson"}
              </h2>
              {lesson.goal_text?.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {lesson.goal_text}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No goal text yet.
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
