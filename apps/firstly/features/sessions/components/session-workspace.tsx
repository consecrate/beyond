"use client"

import { useState } from "react"

import type { LessonRow } from "@/features/lessons/queries"
import { SessionSkillTree } from "@/features/sessions/components/session-skill-tree"
import { SessionSplitPanels } from "@/features/sessions/components/session-split-panels"
import { SessionTextPanel } from "@/features/sessions/components/session-text-panel"
import type { SessionSkillGraphPayload } from "@/features/sessions/queries"

type Props = {
  lessons: LessonRow[]
  skillGraph: SessionSkillGraphPayload | null
}

export function SessionWorkspace({ lessons, skillGraph }: Props) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)

  return (
    <SessionSplitPanels
      left={
        <SessionSkillTree
          lessons={lessons}
          skillGraph={skillGraph}
          selectedLessonId={selectedLessonId}
          onLessonSelect={setSelectedLessonId}
        />
      }
      right={
        <SessionTextPanel
          lessons={lessons}
          skillGraph={skillGraph}
          selectedLessonId={selectedLessonId}
        />
      }
    />
  )
}
